import { useEffect, useRef, useCallback } from 'react';
import * as CANNON from 'cannon-es';
import { useGameStore } from '@/store/gameStore';

export const usePhysics = () => {
  const worldRef = useRef<CANNON.World | null>(null);
  const bodiesMapRef = useRef<Map<string, CANNON.Body>>(new Map());
  const setWorld = useGameStore((s) => s.setWorld);

  useEffect(() => {
    const world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -30, 0),
    });
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.allowSleep = true;
    if ('iterations' in world.solver) {
      (world.solver as any).iterations = 20;
    }
    world.defaultContactMaterial.contactEquationStiffness = 1e6;
    world.defaultContactMaterial.contactEquationRelaxation = 3;

    const groundBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      position: new CANNON.Vec3(0, 0, 0),
    });
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(groundBody);

    worldRef.current = world;
    setWorld(world);

    return () => {
      bodiesMapRef.current.forEach((body) => {
        world.removeBody(body);
      });
      bodiesMapRef.current.clear();
    };
  }, [setWorld]);

  const addBody = useCallback((id: string, body: CANNON.Body) => {
    if (worldRef.current) {
      worldRef.current.addBody(body);
      bodiesMapRef.current.set(id, body);
    }
  }, []);

  const removeBody = useCallback((id: string) => {
    if (worldRef.current) {
      const body = bodiesMapRef.current.get(id);
      if (body) {
        worldRef.current.removeBody(body);
        bodiesMapRef.current.delete(id);
      }
    }
  }, []);

  const getBody = useCallback((id: string) => {
    return bodiesMapRef.current.get(id);
  }, []);

  const step = useCallback((delta: number) => {
    if (worldRef.current) {
      worldRef.current.step(Math.min(1 / 60, delta));
    }
  }, []);

  const applyExplosion = useCallback((position: [number, number, number], radius: number, force: number) => {
    if (!worldRef.current) return;
    const [px, py, pz] = position;
    bodiesMapRef.current.forEach((body) => {
      if (body.mass === 0) return;
      const dx = body.position.x - px;
      const dy = body.position.y - py;
      const dz = body.position.z - pz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < radius && dist > 0.01) {
        const falloff = 1 - dist / radius;
        const impulseMagnitude = force * falloff;
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;
        body.applyImpulse(
          new CANNON.Vec3(nx * impulseMagnitude, ny * impulseMagnitude, nz * impulseMagnitude),
          new CANNON.Vec3(body.position.x, body.position.y, body.position.z)
        );
        body.wakeUp();
      }
    });
  }, []);

  return {
    world: worldRef,
    addBody,
    removeBody,
    getBody,
    step,
    applyExplosion,
  };
};

export default usePhysics;
