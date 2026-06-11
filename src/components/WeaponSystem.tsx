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

interface WreckingBallState {
  ballMesh: THREE.Mesh;
  ballBody: CANNON.Body;
  chainPoints: THREE.Vector3[];
  anchorBody: CANNON.Body;
  constraint: CANNON.Constraint;
  isDragging: boolean;
  dragStartPos: THREE.Vector3;
  aimLine: THREE.Line;
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
  const wreckingBallRef = useRef<WreckingBallState | null>(null);
  const wreckingBallGroupRef = useRef<THREE.Group | null>(null);
  const cooldownTimerRef = useRef(0);
  const launcherRef = useRef<THREE.Group | null>(null);
  const launcherRecoilRef = useRef(0);
  const recoilTargetRef = useRef(0);
  const muzzleFlashRef = useRef(0);
  const lastWeaponRef = useRef<WeaponType | null>(null);
  const wreckingBallId = 'wreckingBall';

  const createLauncher = useCallback((currentWeapon: WeaponType) => {
    if (launcherRef.current) {
      scene.remove(launcherRef.current);
      launcherRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      launcherRef.current = null;
    }

    if (currentWeapon === 'wreckingBall') return;

    const group = new THREE.Group();

    const mainBodyGeo = new THREE.BoxGeometry(0.15, 0.15, 0.4);
    const mainBodyMat = new THREE.MeshStandardMaterial({
      color: '#3a3a3a',
      metalness: 0.9,
      roughness: 0.2,
    });
    const mainBody = new THREE.Mesh(mainBodyGeo, mainBodyMat);
    mainBody.position.z = -0.1;
    group.add(mainBody);

    const barrelGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.3, 16);
    const barrelMat = new THREE.MeshStandardMaterial({
      color: '#2a2a2a',
      metalness: 0.95,
      roughness: 0.1,
    });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = -Math.PI / 2;
    barrel.position.z = -0.35;
    group.add(barrel);

    const muzzleGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.05, 16);
    const muzzleMat = new THREE.MeshStandardMaterial({
      color: '#1a1a1a',
      metalness: 0.9,
      roughness: 0.1,
    });
    const muzzle = new THREE.Mesh(muzzleGeo, muzzleMat);
    muzzle.rotation.x = -Math.PI / 2;
    muzzle.position.z = -0.55;
    group.add(muzzle);

    const gripGeo = new THREE.BoxGeometry(0.12, 0.2, 0.15);
    const gripMat = new THREE.MeshStandardMaterial({
      color: currentWeapon === 'explosive' ? '#8B0000' : '#4a3728',
      metalness: 0.3,
      roughness: 0.7,
    });
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.position.y = -0.15;
    grip.position.z = 0.05;
    group.add(grip);

    const scopeGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.15, 12);
    const scopeMat = new THREE.MeshStandardMaterial({
      color: '#1a1a1a',
      metalness: 0.9,
      roughness: 0.2,
    });
    const scope = new THREE.Mesh(scopeGeo, scopeMat);
    scope.rotation.x = -Math.PI / 2;
    scope.position.y = 0.1;
    scope.position.z = -0.15;
    group.add(scope);

    if (currentWeapon === 'explosive') {
      const indicatorGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
      const indicatorMat = new THREE.MeshStandardMaterial({
        color: '#ff3300',
        emissive: '#ff0000',
        emissiveIntensity: 0.5,
        metalness: 0.5,
        roughness: 0.5,
      });
      const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
      indicator.position.y = 0.12;
      indicator.position.z = 0.1;
      group.add(indicator);
    }

    const muzzleFlashGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const muzzleFlashMat = new THREE.MeshBasicMaterial({
      color: currentWeapon === 'explosive' ? '#ff6600' : '#00ffff',
      transparent: true,
      opacity: 0,
    });
    const muzzleFlash = new THREE.Mesh(muzzleFlashGeo, muzzleFlashMat);
    muzzleFlash.position.z = -0.65;
    muzzleFlash.name = 'muzzleFlash';
    group.add(muzzleFlash);

    group.position.set(0.3, -0.2, -0.5);

    camera.add(group);

    launcherRef.current = group;
  }, [camera, scene]);

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
    (ballBody as any).id = 'wreckingBall';
    (ballBody as any).userData = { isProjectile: true };
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

    const spikeGeo = new THREE.ConeGeometry(0.2, 0.6, 8);
    const spikeMat = new THREE.MeshStandardMaterial({
      color: '#666666',
      metalness: 0.9,
      roughness: 0.2,
    });
    for (let i = 0; i < 8; i++) {
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      const angle = (i / 8) * Math.PI * 2;
      spike.position.set(
        Math.cos(angle) * ballRadius * 0.85,
        (Math.random() - 0.5) * ballRadius * 0.6,
        Math.sin(angle) * ballRadius * 0.85
      );
      spike.lookAt(spike.position.clone().multiplyScalar(2));
      spike.scale.set(1, 1.5, 1);
      group.add(spike);
    }

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

    const aimLineGeo = new THREE.BufferGeometry();
    const aimLineMat = new THREE.LineDashedMaterial({
      color: '#ff6600',
      linewidth: 3,
      dashSize: 0.3,
      gapSize: 0.15,
      transparent: true,
      opacity: 0,
    });
    const aimLine = new THREE.Line(aimLineGeo, aimLineMat);
    group.add(aimLine);

    scene.add(group);
    wreckingBallGroupRef.current = group;

    wreckingBallRef.current = {
      ballMesh,
      ballBody,
      chainPoints,
      anchorBody,
      constraint,
      isDragging: false,
      dragStartPos: new THREE.Vector3(),
      aimLine,
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

    const trailGeo = new THREE.SphereGeometry(ballRadius * 0.6, 12, 12);
    const trailMat = new THREE.MeshBasicMaterial({
      color: '#00ffff',
      transparent: true,
      opacity: 0.6,
    });
    const trail = new THREE.Mesh(trailGeo, trailMat);
    mesh.add(trail);

    const shape = new CANNON.Sphere(ballRadius);
    const body = new CANNON.Body({
      mass: ballMass,
      shape,
      position: new CANNON.Vec3(startPos.x, startPos.y, startPos.z),
      material: new CANNON.Material({ friction: 0.2, restitution: 0.6 }),
    });
    (body as any).userData = { isProjectile: true };

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

    recoilTargetRef.current = 0.3;
    muzzleFlashRef.current = 0.2;
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

    const fuseGeo = new THREE.CylinderGeometry(0.03, 0.02, 0.15, 8);
    const fuseMat = new THREE.MeshStandardMaterial({
      color: '#333333',
      emissive: '#ff6600',
      emissiveIntensity: 1,
    });
    const fuse = new THREE.Mesh(fuseGeo, fuseMat);
    fuse.position.y = ballRadius + 0.07;
    mesh.add(fuse);

    const shape = new CANNON.Sphere(ballRadius);
    const body = new CANNON.Body({
      mass: ballMass,
      shape,
      position: new CANNON.Vec3(startPos.x, startPos.y, startPos.z),
      material: new CANNON.Material({ friction: 0.5, restitution: 0.2 }),
    });
    (body as any).userData = { isProjectile: true };

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

    recoilTargetRef.current = 0.4;
    muzzleFlashRef.current = 0.3;
  }, [camera, addPhysicsBody, scene]);

  useEffect(() => {
    if (weapon !== lastWeaponRef.current) {
      lastWeaponRef.current = weapon;
      if (weapon !== 'wreckingBall') {
        createLauncher(weapon);
      } else if (launcherRef.current) {
        scene.remove(launcherRef.current);
        launcherRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        launcherRef.current = null;
      }
    }
  }, [weapon, createLauncher, scene]);

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

      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('[role="button"]')) return;

      if (weapon === 'steelBall') {
        fireSteelBall();
        setShootCooldown(true);
        cooldownTimerRef.current = 0.15;
      } else if (weapon === 'explosive') {
        fireExplosive();
        setShootCooldown(true);
        cooldownTimerRef.current = 0.8;
      } else if (weapon === 'wreckingBall') {
        if (wreckingBallRef.current && !wreckingBallRef.current.isDragging) {
          wreckingBallRef.current.isDragging = true;
          wreckingBallRef.current.dragStartPos.set(
            e.clientX,
            e.clientY,
            0
          );
          const aimLine = wreckingBallRef.current.aimLine;
          (aimLine.material as THREE.LineDashedMaterial).opacity = 0.8;
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (weapon === 'wreckingBall' && wreckingBallRef.current?.isDragging) {
        const dx = (e.clientX - wreckingBallRef.current.dragStartPos.x);
        const dy = (e.clientY - wreckingBallRef.current.dragStartPos.y);

        const ballBody = wreckingBallRef.current.ballBody;
        const ballPos = new THREE.Vector3(
          ballBody.position.x,
          ballBody.position.y,
          ballBody.position.z
        );
        const anchorPos = new THREE.Vector3(0, 25, -8);

        const aimEnd = ballPos.clone();
        aimEnd.x += dx * 0.03;
        aimEnd.y -= dy * 0.02;
        aimEnd.z += dy * 0.02;

        const points = [ballPos, aimEnd];
        wreckingBallRef.current.aimLine.geometry.setFromPoints(points);
        wreckingBallRef.current.aimLine.computeLineDistances();
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;

      if (weapon === 'wreckingBall' && wreckingBallRef.current?.isDragging) {
        const dx = (e.clientX - wreckingBallRef.current.dragStartPos.x);
        const dy = (e.clientY - wreckingBallRef.current.dragStartPos.y);

        const impulseX = dx * 15;
        const impulseZ = -dy * 12;
        const impulseY = Math.max(0, -dy * 8) + 100;

        wreckingBallRef.current.ballBody.applyImpulse(
          new CANNON.Vec3(impulseX, impulseY, impulseZ),
          wreckingBallRef.current.ballBody.position
        );

        wreckingBallRef.current.isDragging = false;
        (wreckingBallRef.current.aimLine.material as THREE.LineDashedMaterial).opacity = 0;
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [weapon, shootCooldown, fireSteelBall, fireExplosive, setShootCooldown]);

  useFrame((_, delta) => {
    if (cooldownTimerRef.current > 0) {
      cooldownTimerRef.current -= delta;
      if (cooldownTimerRef.current <= 0) {
        setShootCooldown(false);
      }
    }

    if (launcherRef.current) {
      launcherRecoilRef.current += (recoilTargetRef.current - launcherRecoilRef.current) * delta * 15;
      recoilTargetRef.current *= Math.pow(0.01, delta);

      launcherRef.current.position.z = -0.5 + launcherRecoilRef.current;

      if (muzzleFlashRef.current > 0) {
        muzzleFlashRef.current -= delta;
        const muzzleFlash = launcherRef.current.getObjectByName('muzzleFlash') as THREE.Mesh;
        if (muzzleFlash && muzzleFlash.material instanceof THREE.MeshBasicMaterial) {
          muzzleFlash.material.opacity = Math.max(0, muzzleFlashRef.current / 0.2);
          muzzleFlash.scale.setScalar(1 + (1 - muzzleFlash.material.opacity) * 2);
        }
      }

      const bobOffset = Math.sin(performance.now() * 0.002) * 0.005;
      launcherRef.current.position.y = -0.2 + bobOffset;
    }

    if (wreckingBallRef.current && wreckingBallGroupRef.current) {
      const { ballBody, ballMesh, chainPoints, anchorBody, aimLine } = wreckingBallRef.current;
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

      if (wreckingBallRef.current.isDragging) {
        const hue = (performance.now() * 0.001) % 1;
        (aimLine.material as THREE.LineDashedMaterial).color.setHSL(hue, 1, 0.6);
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

      if (projectile.type === 'steelBall') {
        const trail = projectile.mesh.children[0] as THREE.Mesh;
        if (trail && trail.material instanceof THREE.MeshBasicMaterial) {
          trail.material.opacity = Math.min(1, body.velocity.length() / 30) * 0.8;
          trail.scale.setScalar(0.5 + body.velocity.length() / 60);
        }
      }

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

        const fuse = projectile.mesh.children[0] as THREE.Mesh;
        if (fuse && fuse.material instanceof THREE.MeshStandardMaterial) {
          fuse.material.emissiveIntensity = 0.8 + Math.sin(performance.now() * 0.02) * 0.5;
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
