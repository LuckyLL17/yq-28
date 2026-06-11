import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, generateId, MaterialType, materialProperties } from '@/store/gameStore';

interface ParticlesProps {
  maxParticles?: number;
}

export function Particles({ maxParticles = 500 }: ParticlesProps) {
  const particles = useGameStore((s) => s.particles);
  const updateParticle = useGameStore((s) => s.updateParticle);
  const removeParticle = useGameStore((s) => s.removeParticle);
  const addParticle = useGameStore((s) => s.addParticle);

  const positions = useMemo(() => new Float32Array(maxParticles * 3), [maxParticles]);
  const colors = useMemo(() => new Float32Array(maxParticles * 3), [maxParticles]);
  const sizes = useMemo(() => new Float32Array(maxParticles), [maxParticles]);
  const opacities = useMemo(() => new Float32Array(maxParticles), [maxParticles]);

  const pointsRef = useRef<THREE.Points>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const particleData = useRef<Map<string, {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    color: THREE.Color;
    size: number;
    life: number;
    maxLife: number;
    index: number;
  }>>(new Map());
  const nextIndex = useRef(0);
  const activeCount = useRef(0);

  useEffect(() => {
    window.__spawnParticles = (position: [number, number, number], material: MaterialType, count: number = 15) => {
      const properties = materialProperties[material];
      const baseColor = new THREE.Color(properties.color);

      for (let i = 0; i < count; i++) {
        if (activeCount.current >= maxParticles) break;

        const id = generateId();
        const index = nextIndex.current;
        nextIndex.current = (nextIndex.current + 1) % maxParticles;
        activeCount.current = Math.min(activeCount.current + 1, maxParticles);

        const velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          Math.random() * 10 + 3,
          (Math.random() - 0.5) * 12
        );

        const colorVariation = new THREE.Color().setHSL(
          baseColor.getHSL({ h: 0, s: 0, l: 0 }).h + (Math.random() - 0.5) * 0.05,
          Math.min(1, baseColor.getHSL({ h: 0, s: 0, l: 0 }).s + (Math.random() - 0.5) * 0.1),
          Math.min(1, Math.max(0, baseColor.getHSL({ h: 0, s: 0, l: 0 }).l + (Math.random() - 0.5) * 0.2))
        );

        particleData.current.set(id, {
          position: new THREE.Vector3(
            position[0] + (Math.random() - 0.5) * 0.5,
            position[1] + (Math.random() - 0.5) * 0.5,
            position[2] + (Math.random() - 0.5) * 0.5
          ),
          velocity,
          color: colorVariation,
          size: (material === 'glass' ? 0.08 : 0.15) + Math.random() * 0.2,
          life: 1.5 + Math.random() * 1.5,
          maxLife: 3,
          index,
        });

        addParticle({
          id,
          position: [position[0], position[1], position[2]],
          velocity: [velocity.x, velocity.y, velocity.z],
          color: colorVariation.getStyle(),
          size: 0.15,
          life: 3,
          maxLife: 3,
        });
      }
    };

    return () => {
      delete window.__spawnParticles;
    };
  }, [addParticle, maxParticles]);

  useFrame((_, delta) => {
    const gravity = -25;
    const drag = 0.98;
    const idsToRemove: string[] = [];

    particleData.current.forEach((data, id) => {
      data.life -= delta;
      if (data.life <= 0) {
        idsToRemove.push(id);
        return;
      }

      data.velocity.y += gravity * delta;
      data.velocity.x *= Math.pow(drag, delta * 60);
      data.velocity.y *= Math.pow(drag, delta * 60);
      data.velocity.z *= Math.pow(drag, delta * 60);

      data.position.x += data.velocity.x * delta;
      data.position.y += data.velocity.y * delta;
      data.position.z += data.velocity.z * delta;

      if (data.position.y < 0.1) {
        data.position.y = 0.1;
        data.velocity.y *= -0.3;
        data.velocity.x *= 0.7;
        data.velocity.z *= 0.7;
      }

      const i = data.index * 3;
      positions[i] = data.position.x;
      positions[i + 1] = data.position.y;
      positions[i + 2] = data.position.z;

      colors[i] = data.color.r;
      colors[i + 1] = data.color.g;
      colors[i + 2] = data.color.b;

      sizes[data.index] = data.size * (data.life / data.maxLife);
      opacities[data.index] = Math.min(1, data.life / 0.5);
    });

    idsToRemove.forEach((id) => {
      const data = particleData.current.get(id);
      if (data) {
        const i = data.index * 3;
        positions[i + 1] = -100;
        opacities[data.index] = 0;
        particleData.current.delete(id);
        activeCount.current = Math.max(0, activeCount.current - 1);
      }
      removeParticle(id);
    });

    if (geometryRef.current) {
      geometryRef.current.attributes.position.needsUpdate = true;
      geometryRef.current.attributes.color.needsUpdate = true;
      geometryRef.current.attributes.size.needsUpdate = true;
      geometryRef.current.attributes.opacity.needsUpdate = true;
      geometryRef.current.setDrawRange(0, Math.min(activeCount.current, maxParticles));
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute
          attach="attributes-position"
          count={maxParticles}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={maxParticles}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={maxParticles}
          array={sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-opacity"
          count={maxParticles}
          array={opacities}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.2}
        vertexColors
        transparent
        opacity={1}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

interface ExplosionEffectProps {
  position: [number, number, number];
  radius: number;
  onComplete: () => void;
}

export function ExplosionEffect({ position, radius, onComplete }: ExplosionEffectProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const lifeRef = useRef(0);
  const maxLife = 0.8;

  useFrame((_, delta) => {
    lifeRef.current += delta;
    const progress = lifeRef.current / maxLife;

    if (meshRef.current) {
      const scale = progress * radius * 2;
      meshRef.current.scale.set(scale, scale, scale);
      const material = meshRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 1 - progress * progress);
    }

    if (progress >= 1) {
      onComplete();
    }
  });

  return (
    <>
      <mesh ref={meshRef} position={position}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshBasicMaterial
          color="#ff6600"
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh position={position}>
        <sphereGeometry args={[radius * 0.3, 16, 16]} />
        <meshBasicMaterial
          color="#ffff00"
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <pointLight
        position={position}
        color="#ff8800"
        intensity={50}
        distance={radius * 5}
        decay={2}
      />
    </>
  );
}

export function spawnParticles(position: [number, number, number], material: MaterialType, count?: number) {
  if (window.__spawnParticles) {
    window.__spawnParticles(position, material, count);
  }
}

export default Particles;

declare global {
  interface Window {
    __spawnParticles?: (position: [number, number, number], material: MaterialType, count?: number) => void;
  }
}
