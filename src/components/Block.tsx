import { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { useGameStore, MaterialType, materialProperties, generateId, BlockData } from '@/store/gameStore';

interface BlockProps {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  material: MaterialType;
  addPhysicsBody: (id: string, body: CANNON.Body) => void;
  removePhysicsBody: (id: string) => void;
  getPhysicsBody: (id: string) => CANNON.Body | undefined;
  onDestroy: (position: [number, number, number], material: MaterialType) => void;
  spawnDebris?: (position: [number, number, number], size: [number, number, number], material: MaterialType) => void;
}

interface CrackData {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

export function Block({
  id,
  position,
  size,
  material,
  addPhysicsBody,
  removePhysicsBody,
  getPhysicsBody,
  onDestroy,
  spawnDebris,
}: BlockProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const [opacity, setOpacity] = useState(1);
  const [destroyed, setDestroyed] = useState(false);
  const blockData = useGameStore((s) => s.blocks.get(id));
  const damageBlock = useGameStore((s) => s.damageBlock);
  const damageFlash = useRef(0);
  const cracksRef = useRef<THREE.Mesh[]>([]);

  const properties = materialProperties[material];
  const isGlass = material === 'glass';
  const healthPercent = blockData ? blockData.health / blockData.maxHealth : 1;

  const cracks = useMemo<CrackData[]>(() => {
    const crackCount = Math.max(0, Math.floor((1 - healthPercent) * 6));
    const result: CrackData[] = [];
    for (let i = 0; i < crackCount; i++) {
      result.push({
        position: [
          (Math.random() - 0.5) * size[0] * 0.9,
          (Math.random() - 0.5) * size[1] * 0.9,
          (Math.random() - 0.5) * size[2] * 0.9,
        ],
        rotation: [
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI,
        ],
        scale: 0.5 + Math.random() * 0.8,
      });
    }
    return result;
  }, [healthPercent, size]);

  useEffect(() => {
    const properties = materialProperties[material];
    const halfSize: [number, number, number] = [size[0] / 2, size[1] / 2, size[2] / 2];
    const volume = size[0] * size[1] * size[2];
    const mass = properties.density * volume * 0.000001;

    const shape = new CANNON.Box(new CANNON.Vec3(halfSize[0], halfSize[1], halfSize[2]));
    const body = new CANNON.Body({
      mass: mass > 0 ? mass : 1,
      shape,
      position: new CANNON.Vec3(position[0], position[1], position[2]),
      material: new CANNON.Material({ friction: 0.6, restitution: 0.05 }),
      linearDamping: 0.15,
      angularDamping: 0.25,
      allowSleep: true,
      sleepSpeedLimit: 0.15,
      sleepTimeLimit: 0.5,
    });

    (body as any).userData = { blockId: id, blockMaterial: material, blockSize: size };

    let creationTime = performance.now();

    body.addEventListener('collide', (event: any) => {
      const age = performance.now() - creationTime;
      if (age < 500) return;

      const impactVelocity = event.contact.getImpactVelocityAlongNormal();
      if (impactVelocity > 4) {
        const damage = impactVelocity * 5;
        damageFlash.current = 0.3;
        if (damageBlock(id, damage)) {
          setDestroyed(true);
          if (meshRef.current) {
            const pos = meshRef.current.position;
            onDestroy([pos.x, pos.y, pos.z], material);
            if (spawnDebris) {
              spawnDebris([pos.x, pos.y, pos.z], size, material);
            }
          }
        }
      }
    });

    addPhysicsBody(id, body);

    return () => {
      removePhysicsBody(id);
    };
  }, [id, position, size, material, addPhysicsBody, removePhysicsBody, damageBlock, onDestroy, spawnDebris]);

  useFrame((_, delta) => {
    const body = getPhysicsBody(id);
    if (body && meshRef.current && !destroyed) {
      meshRef.current.position.x = body.position.x;
      meshRef.current.position.y = body.position.y;
      meshRef.current.position.z = body.position.z;
      meshRef.current.quaternion.x = body.quaternion.x;
      meshRef.current.quaternion.y = body.quaternion.y;
      meshRef.current.quaternion.z = body.quaternion.z;
      meshRef.current.quaternion.w = body.quaternion.w;
    }

    if (damageFlash.current > 0 && materialRef.current) {
      damageFlash.current -= delta;
      const intensity = Math.max(0, damageFlash.current / 0.3);
      materialRef.current.emissiveIntensity = intensity * 2;
    } else if (materialRef.current) {
      materialRef.current.emissiveIntensity = 0;
    }

    if (destroyed) {
      const newOpacity = opacity - delta * 4;
      if (newOpacity <= 0) {
        setOpacity(0);
      } else {
        setOpacity(newOpacity);
      }
    }
  });

  if (destroyed && opacity <= 0) return null;

  const crackColor = isGlass ? '#1a1a3a' : '#1a1a1a';
  const currentScale = destroyed ? 1 + (1 - opacity) * 0.1 : 1;

  return (
    <group>
      <mesh
        ref={meshRef}
        position={position}
        castShadow
        receiveShadow
        visible={!destroyed || opacity > 0}
        scale={currentScale}
      >
        <boxGeometry args={size} />
        <meshStandardMaterial
          ref={materialRef}
          color={properties.color}
          transparent={isGlass || destroyed}
          opacity={destroyed ? opacity : (isGlass ? 0.6 : 1)}
          roughness={material === 'wood' ? 0.8 : material === 'concrete' ? 0.9 : 0.1}
          metalness={material === 'concrete' ? 0.1 : material === 'glass' ? 0.9 : 0.05}
          emissive={properties.color}
          emissiveIntensity={0}
          envMapIntensity={isGlass ? 1.5 : 1}
        />
      </mesh>

      {!destroyed && cracks.map((crack, i) => (
        <mesh
          key={`${id}-crack-${i}`}
          position={[
            position[0] + crack.position[0],
            position[1] + crack.position[1],
            position[2] + crack.position[2],
          ]}
          rotation={crack.rotation}
          scale={[crack.scale * size[0] * 0.6, crack.scale * size[1] * 0.6, 0.01]}
          onUpdate={(mesh) => {
            if (meshRef.current) {
              mesh.position.copy(meshRef.current.position);
              mesh.quaternion.copy(meshRef.current.quaternion);
            }
          }}
        >
          <boxGeometry args={[1, 1, 0.01]} />
          <meshBasicMaterial
            color={crackColor}
            transparent
            opacity={Math.min(1, (1 - healthPercent) * 1.5)}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      ))}

      {!destroyed && healthPercent < 0.5 && (
        <mesh
          position={position}
          onUpdate={(mesh) => {
            if (meshRef.current) {
              mesh.position.copy(meshRef.current.position);
              mesh.quaternion.copy(meshRef.current.quaternion);
            }
          }}
        >
          <boxGeometry args={[size[0] * 1.01, size[1] * 1.01, size[2] * 1.01]} />
          <meshBasicMaterial
            color="#ff2200"
            transparent
            opacity={Math.max(0, (0.5 - healthPercent) * 0.4)}
            wireframe
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

export function createBlockData(
  position: [number, number, number],
  size: [number, number, number],
  material: MaterialType
): BlockData {
  const properties = materialProperties[material];
  return {
    id: generateId(),
    position,
    size,
    material,
    health: properties.health,
    maxHealth: properties.health,
  };
}

export default Block;
