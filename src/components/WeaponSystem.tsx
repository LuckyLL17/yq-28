import { useRef, useEffect, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { useGameStore, WeaponType } from '@/store/gameStore';

interface WeaponSystemProps {
  addPhysicsBody: (id: string, body: CANNON.Body) => void;
  removePhysicsBody: (id: string) => void;
  getPhysicsBody: (id: string) => CANNON.Body | undefined;
  applyExplosion: (position: [number, number, number], radius: number, force: number) => void;
  onExplosion: (position: [number, number, number], radius: number) => void;
}

interface Projectile {
  id: string;
  type: 'steelBall' | 'explosive';
  mesh: THREE.Mesh;
  body: CANNON.Body;
  life: number;
  exploded?: boolean;
}

export function WeaponSystem({
  addPhysicsBody,
  removePhysicsBody,
  getPhysicsBody,
  applyExplosion,
  onExplosion,
}: WeaponSystemProps) {
  const { camera, scene } = useThree();
  const weapon = useGameStore((s) => s.weapon);
  const shootCooldown = useGameStore((s) => s.shootCooldown);
  const setShootCooldown = useGameStore((s) => s.setShootCooldown);
  const wreckingBallActive = useGameStore((s) => s.wreckingBallActive);
  const setWreckingBallActive = useGameStore((s) => s.setWreckingBallActive);

  const projectilesRef = useRef<Map<string, Projectile>>(new Map());
  const wreckingBallRef = useRef<{
    ballMesh: THREE.Mesh;
    ballBody: CANNON.Body;
    chainPoints: THREE.Vector3[];
    anchorBody: CANNON.Body;
    constraint: CANNON.Constraint;
  } | null>(null);
  const wreckingBallGroupRef = useRef<THREE.Group | null>(null);
  const cooldownTimerRef = useRef(0);

  const wreckingBallId = 'wreckingBall';

  const createWreckingBall = useCallback(() => {
    if (wreckingBallRef.current) return;

    const anchorPosition = new CANNON.Vec3(0, 25, -8);
    const ballStartPosition = new CANNON.Vec3(-5, 20, -8);

    const anchorBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Sphere(0.3),
      position: anchorPosition,
    });
    addPhysicsBody('wreckingAnchor', anchorBody);

    const ballMass = 500;
    const ballRadius = 1.2;
    const ballBody = new CANNON.Body({
      mass: ballMass,
      shape: new CANNON.Sphere(ballRadius),
      position: ballStartPosition,
      material: new CANNON.Material({ friction: 0.3, restitution: 0.4 }),
      linearDamping: 0.05,
      angularDamping: 0.05,
    });
    addPhysicsBody(wreckingBallId, ballBody);

    const constraint = new CANNON.DistanceConstraint(anchorBody, ballBody, 8);
    if (useGameStore.getState().world) {
      useGameStore.getState().world!.addConstraint(constraint);
    }

    const group = new THREE.Group();

    const ballGeometry = new THREE.SphereGeometry(ballRadius, 32, 32);
    const ballMaterial = new THREE.MeshStandardMaterial({
      color: '#444444',
      metalness: 0.9,
      roughness: 0.3,
    });
    const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
    ballMesh.castShadow = true;
    ballMesh.receiveShadow = true;
    group.add(ballMesh);

    const chainPoints: THREE.Vector3[] = [];
    const chainSegments = 15;
    const chainGeometry = new THREE.CylinderGeometry(0.08, 0.08, 1, 8);
    const chainMaterial = new THREE.MeshStandardMaterial({
      color: '#666666',
      metalness: 0.8,
      roughness: 0.4,
    });

    for (let i = 0; i < chainSegments; i++) {
      const link = new THREE.Mesh(chainGeometry, chainMaterial);
      link.userData.chainIndex = i;
      group.add(link);
      chainPoints.push(new THREE.Vector3());
    }

    scene.add(group);
    wreckingBallGroupRef.current = group;

    wreckingBallRef.current = {
      ballMesh,
      ballBody,
      chainPoints,
      anchorBody,
      constraint,
    };

    setWreckingBallActive(true);
  }, [addPhysicsBody, scene, setWreckingBallActive]);

  const removeWreckingBall = useCallback(() => {
    if (!wreckingBallRef.current) return;

    const world = useGameStore.getState().world;
    if (world && wreckingBallRef.current.constraint) {
      world.removeConstraint(wreckingBallRef.current.constraint);
    }

    removePhysicsBody('wreckingAnchor');
    removePhysicsBody(wreckingBallId);

    if (wreckingBallGroupRef.current) {
      scene.remove(wreckingBallGroupRef.current);
      wreckingBallGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      wreckingBallGroupRef.current = null;
    }

    wreckingBallRef.current = null;
    setWreckingBallActive(false);
  }, [removePhysicsBody, scene, setWreckingBallActive]);

  const fireSteelBall = useCallback(() => {
    const id = `steelBall_${Date.now()}_${Math.random()}`;

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    const startPos = new THREE.Vector3();
    camera.getWorldPosition(startPos);
    startPos.add(direction.clone().multiplyScalar(2));

    const ballRadius = 0.25;
    const ballMass = 15;

    const geometry = new THREE.SphereGeometry(ballRadius, 24, 24);
    const material = new THREE.MeshStandardMaterial({
      color: '#888888',
      metalness: 0.95,
      roughness: 0.15,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.position.copy(startPos);
    scene.add(mesh);

    const shape = new CANNON.Sphere(ballRadius);
    const body = new CANNON.Body({
      mass: ballMass,
      shape,
      position: new CANNON.Vec3(startPos.x, startPos.y, startPos.z),
      material: new CANNON.Material({ friction: 0.2, restitution: 0.6 }),
    });

    const speed = 55;
    body.velocity.set(
      direction.x * speed,
      direction.y * speed,
      direction.z * speed
    );
    body.angularVelocity.set(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10
    );

    addPhysicsBody(id, body);

    projectilesRef.current.set(id, {
      id,
      type: 'steelBall',
      mesh,
      body,
      life: 8,
    });
  }, [camera, addPhysicsBody, scene]);

  const fireExplosive = useCallback(() => {
    const id = `explosive_${Date.now()}_${Math.random()}`;

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    const startPos = new THREE.Vector3();
    camera.getWorldPosition(startPos);
    startPos.add(direction.clone().multiplyScalar(2));

    const ballRadius = 0.2;
    const ballMass = 5;

    const geometry = new THREE.SphereGeometry(ballRadius, 20, 20);
    const material = new THREE.MeshStandardMaterial({
      color: '#ff3300',
      emissive: '#ff0000',
      emissiveIntensity: 0.5,
      metalness: 0.5,
      roughness: 0.5,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.position.copy(startPos);
    scene.add(mesh);

    const shape = new CANNON.Sphere(ballRadius);
    const body = new CANNON.Body({
      mass: ballMass,
      shape,
      position: new CANNON.Vec3(startPos.x, startPos.y, startPos.z),
      material: new CANNON.Material({ friction: 0.5, restitution: 0.2 }),
    });

    const speed = 35;
    body.velocity.set(
      direction.x * speed,
      direction.y * speed + 5,
      direction.z * speed
    );

    addPhysicsBody(id, body);

    projectilesRef.current.set(id, {
      id,
      type: 'explosive',
      mesh,
      body,
      life: 10,
      exploded: false,
    });
  }, [camera, addPhysicsBody, scene]);

  useEffect(() => {
    if (weapon === 'wreckingBall' && !wreckingBallActive) {
      createWreckingBall();
    } else if (weapon !== 'wreckingBall' && wreckingBallActive) {
      removeWreckingBall();
    }
  }, [weapon, wreckingBallActive, createWreckingBall, removeWreckingBall]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || shootCooldown) return;
      if (weapon === 'steelBall') {
        fireSteelBall();
        setShootCooldown(true);
        cooldownTimerRef.current = 0.15;
      } else if (weapon === 'explosive') {
        fireExplosive();
        setShootCooldown(true);
        cooldownTimerRef.current = 0.8;
      } else if (weapon === 'wreckingBall') {
        if (wreckingBallRef.current) {
          const pushDirection = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            0.5,
            Math.random()
          ).normalize();
          wreckingBallRef.current.ballBody.applyImpulse(
            new CANNON.Vec3(
              pushDirection.x * 800,
              pushDirection.y * 400,
              pushDirection.z * 800
            ),
            wreckingBallRef.current.ballBody.position
          );
        }
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    return () => window.removeEventListener('mousedown', handleMouseDown);
  }, [weapon, shootCooldown, fireSteelBall, fireExplosive, setShootCooldown]);

  useFrame((_, delta) => {
    if (cooldownTimerRef.current > 0) {
      cooldownTimerRef.current -= delta;
      if (cooldownTimerRef.current <= 0) {
        setShootCooldown(false);
      }
    }

    if (wreckingBallRef.current && wreckingBallGroupRef.current) {
      const { ballBody, ballMesh, chainPoints, anchorBody } = wreckingBallRef.current;
      const group = wreckingBallGroupRef.current;

      ballMesh.position.set(ballBody.position.x, ballBody.position.y, ballBody.position.z);
      ballMesh.quaternion.set(
        ballBody.quaternion.x,
        ballBody.quaternion.y,
        ballBody.quaternion.z,
        ballBody.quaternion.w
      );

      const chainSegments = chainPoints.length;
      const ballPos = new THREE.Vector3(
        ballBody.position.x,
        ballBody.position.y,
        ballBody.position.z
      );
      const anchorPos = new THREE.Vector3(
        anchorBody.position.x,
        anchorBody.position.y,
        anchorBody.position.z
      );

      for (let i = 0; i < chainSegments; i++) {
        const t = (i + 1) / (chainSegments + 1);
        chainPoints[i].lerpVectors(anchorPos, ballPos, t);
        chainPoints[i].y -= Math.sin(t * Math.PI) * 0.3;

        const link = group.children.find(
          (c) => (c as THREE.Mesh).userData.chainIndex === i
        ) as THREE.Mesh | undefined;

        if (link) {
          link.position.copy(chainPoints[i]);
          const nextPoint = i === chainSegments - 1 ? ballPos : chainPoints[i + 1];
          const prevPoint = i === 0 ? anchorPos : chainPoints[i - 1];
          const direction = new THREE.Vector3()
            .subVectors(nextPoint, prevPoint)
            .normalize();
          link.up.copy(direction);
          link.scale.y = anchorPos.distanceTo(ballPos) / (chainSegments + 1);
        }
      }
    }

    const projectilesToRemove: string[] = [];

    projectilesRef.current.forEach((projectile, id) => {
      const body = getPhysicsBody(id);
      if (!body) {
        projectilesToRemove.push(id);
        return;
      }

      projectile.life -= delta;
      projectile.mesh.position.set(body.position.x, body.position.y, body.position.z);
      projectile.mesh.quaternion.set(
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w
      );

      if (projectile.type === 'explosive' && !projectile.exploded) {
        const impactVelocity = body.velocity.length();
        if (impactVelocity < 8 && projectile.life < 9) {
          projectile.exploded = true;
          const pos: [number, number, number] = [
            body.position.x,
            body.position.y,
            body.position.z,
          ];
          applyExplosion(pos, 8, 15000);
          onExplosion(pos, 8);
          projectile.life = 0.1;
        }
      }

      if (projectile.life <= 0) {
        projectilesToRemove.push(id);
      }
    });

    projectilesToRemove.forEach((id) => {
      const projectile = projectilesRef.current.get(id);
      if (projectile) {
        scene.remove(projectile.mesh);
        projectile.mesh.geometry.dispose();
        if (Array.isArray(projectile.mesh.material)) {
          projectile.mesh.material.forEach((m) => m.dispose());
        } else {
          projectile.mesh.material.dispose();
        }
        removePhysicsBody(id);
        projectilesRef.current.delete(id);
      }
    });
  });

  return null;
}

export function WeaponAimIndicator() {
  const weapon = useGameStore((s) => s.weapon);
  const { camera, scene } = useThree();
  const lineRef = useRef<THREE.Line | null>(null);

  useFrame(() => {
    if (weapon === 'wreckingBall') {
      if (lineRef.current) {
        scene.remove(lineRef.current);
        lineRef.current.geometry.dispose();
        (lineRef.current.material as THREE.LineBasicMaterial).dispose();
        lineRef.current = null;
      }
      return;
    }

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const startPos = new THREE.Vector3();
    camera.getWorldPosition(startPos);
    startPos.add(direction.clone().multiplyScalar(1.5));

    const endPos = startPos.clone().add(direction.clone().multiplyScalar(100));
    const points = [startPos, endPos];

    if (!lineRef.current) {
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineDashedMaterial({
        color: weapon === 'explosive' ? '#ff3300' : '#00ff88',
        transparent: true,
        opacity: 0.5,
        dashSize: 0.5,
        gapSize: 0.3,
      });
      lineRef.current = new THREE.Line(geometry, material);
      lineRef.current.computeLineDistances();
      scene.add(lineRef.current);
    } else {
      lineRef.current.geometry.setFromPoints(points);
      lineRef.current.computeLineDistances();
    }
  });

  return null;
}

export default WeaponSystem;
