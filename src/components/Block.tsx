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

function hslToThreeColor(h: number, s: number, l: number): THREE.Color {
  const color = new THREE.Color();
  color.setHSL(h, s, l);
  return color;
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
  const damageFlash = useRef(0);
  const cracksRef = useRef<THREE.Mesh[]>([]);

  const audioAnalysis = useGameStore((s) => s.audioAnalysis);
  const audioEnabled = useGameStore((s) => s.audioEnabled);
  const audioEffectsConfig = useGameStore((s) => s.audioEffectsConfig);

  const audioShakeRef = useRef({ x: 0, y: 0, z: 0 });
  const audioGlowRef = useRef(0);
  const targetScaleRef = useRef(new THREE.Vector3(1, 1, 1));
  const currentScaleRef = useRef(new THREE.Vector3(1, 1, 1));
  const rainbowPhase = useRef(Math.random() * Math.PI * 2);
  const baseColorRef = useRef(new THREE.Color(materialProperties[material].color));
  const audioColorRef = useRef(new THREE.Color(materialProperties[material].color));
  const audioDamageAccum = useRef(0);
  const collapseCooldown = useRef(0);

  const onDestroyRef = useRef(onDestroy);
  onDestroyRef.current = onDestroy;
  const spawnDebrisRef = useRef(spawnDebris);
  spawnDebrisRef.current = spawnDebris;
  const damageBlockRef = useRef(useGameStore.getState().damageBlock);
  damageBlockRef.current = useGameStore.getState().damageBlock;

  const properties = materialProperties[material];
  const isGlass = material === 'glass';
  const healthPercent = blockData ? blockData.health / blockData.maxHealth : 1;

  const blockPosHash = useMemo(() => {
    return Math.sin(position[0] * 12.9898 + position[1] * 78.233 + position[2] * 37.719) * 43758.5453 % 1;
  }, [position[0], position[1], position[2]]);

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
    const props = materialProperties[material];
    const halfSize: [number, number, number] = [size[0] / 2 * 0.92, size[1] / 2 * 0.92, size[2] / 2 * 0.92];
    const volume = size[0] * size[1] * size[2];
    const mass = props.density * volume * 0.000001;

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

    body.sleep();

    let creationTime = performance.now();

    const yOffset = Math.max(0, position[1]);
    const wakeDelay = 500 + yOffset * 350 + Math.random() * 300;
    const wakeTimer = setTimeout(() => {
      body.wakeUp();
    }, wakeDelay);

    body.addEventListener('collide', (event: any) => {
      const age = performance.now() - creationTime;
      if (age < 1000) return;

      const otherBody = event.body;
      const otherUserData = (otherBody as any).userData;
      const isWeaponImpact =
        otherUserData?.isWreckingBall === true ||
        otherUserData?.isProjectile === true ||
        otherUserData?.isDebris === true;

      if (!isWeaponImpact) return;

      const impactVelocity = event.contact.getImpactVelocityAlongNormal();
      if (impactVelocity > 2) {
        const damage = impactVelocity * 8;
        damageFlash.current = 0.3;
        if (damageBlockRef.current(id, damage)) {
          setDestroyed(true);
          if (meshRef.current) {
            const pos = meshRef.current.position;
            onDestroyRef.current([pos.x, pos.y, pos.z], material);
            if (spawnDebrisRef.current) {
              spawnDebrisRef.current([pos.x, pos.y, pos.z], size, material);
            }
          }
        }
      }
    });

    addPhysicsBody(id, body);

    return () => {
      clearTimeout(wakeTimer);
      removePhysicsBody(id);
    };
  }, [id, position[0], position[1], position[2], size[0], size[1], size[2], material, addPhysicsBody, removePhysicsBody]);

  useFrame((state, delta) => {
    const body = getPhysicsBody(id);
    if (body && meshRef.current && !destroyed) {
      if (audioEnabled && audioAnalysis.volume > 0.01) {
        const { shakeIntensity } = audioEffectsConfig;
        const { bass, mid, treble, beatDetected } = audioAnalysis;

        const freqBand = blockPosHash < 0.33 ? bass : blockPosHash < 0.66 ? mid : treble;

        const shakeAmp = 0.05 + bass * 0.25 * shakeIntensity;
        const beatBoost = beatDetected ? 2.5 : 1;

        audioShakeRef.current.x += ((Math.random() - 0.5) * shakeAmp * beatBoost - audioShakeRef.current.x) * 0.25;
        audioShakeRef.current.y += ((Math.random() - 0.5) * shakeAmp * 0.8 * beatBoost - audioShakeRef.current.y) * 0.25;
        audioShakeRef.current.z += ((Math.random() - 0.5) * shakeAmp * beatBoost - audioShakeRef.current.z) * 0.25;

        const pulseScale = 1 + freqBand * 0.12 * shakeIntensity + (beatDetected ? 0.06 : 0);
        targetScaleRef.current.setScalar(pulseScale);

        currentScaleRef.current.lerp(targetScaleRef.current, 0.2);

        meshRef.current.position.x = body.position.x + audioShakeRef.current.x;
        meshRef.current.position.y = body.position.y + audioShakeRef.current.y + Math.sin(state.clock.elapsedTime * 2 + blockPosHash * 10) * bass * 0.1 * shakeIntensity;
        meshRef.current.position.z = body.position.z + audioShakeRef.current.z;

        meshRef.current.scale.copy(currentScaleRef.current);
      } else {
        audioShakeRef.current.x *= 0.8;
        audioShakeRef.current.y *= 0.8;
        audioShakeRef.current.z *= 0.8;
        currentScaleRef.current.lerp(new THREE.Vector3(1, 1, 1), 0.15);

        meshRef.current.position.x = body.position.x + audioShakeRef.current.x;
        meshRef.current.position.y = body.position.y + audioShakeRef.current.y;
        meshRef.current.position.z = body.position.z + audioShakeRef.current.z;
        meshRef.current.scale.copy(currentScaleRef.current);
      }

      meshRef.current.quaternion.x = body.quaternion.x;
      meshRef.current.quaternion.y = body.quaternion.y;
      meshRef.current.quaternion.z = body.quaternion.z;
      meshRef.current.quaternion.w = body.quaternion.w;
    }

    if (materialRef.current) {
      if (audioEnabled && audioAnalysis.volume > 0.01) {
        const { glowIntensity, colorMode } = audioEffectsConfig;
        const { bass, mid, treble, beatDetected } = audioAnalysis;

        const freqBand = blockPosHash < 0.33 ? bass : blockPosHash < 0.66 ? mid : treble;

        const targetGlow = (freqBand * 2 + (beatDetected ? 0.8 : 0)) * glowIntensity;
        audioGlowRef.current += (targetGlow - audioGlowRef.current) * 0.2;

        const emissiveIntensity = Math.max(
          damageFlash.current > 0 ? (damageFlash.current / 0.3) * 2 : 0,
          audioGlowRef.current
        );

        switch (colorMode) {
          case 'frequency': {
            const hue = blockPosHash < 0.33 ? 0.02 : blockPosHash < 0.66 ? 0.12 : 0.58;
            const saturation = 0.6 + freqBand * 0.4;
            const lightness = 0.25 + freqBand * 0.35;
            audioColorRef.current = hslToThreeColor(hue, saturation, lightness);
            break;
          }
          case 'rainbow': {
            rainbowPhase.current += delta * (0.5 + bass * 2);
            const hue = (rainbowPhase.current + blockPosHash) % 1;
            audioColorRef.current = hslToThreeColor(hue, 0.85, 0.45 + freqBand * 0.25);
            break;
          }
          case 'pulse': {
            const baseHue = new THREE.Color(properties.color).getHSL({ h: 0, s: 0, l: 0 }).h;
            const hue = (baseHue + beatDetected ? 0.05 : 0) % 1;
            audioColorRef.current = hslToThreeColor(hue, 0.7, 0.3 + freqBand * 0.4);
            break;
          }
          case 'material':
          default: {
            audioColorRef.current.copy(baseColorRef.current);
            break;
          }
        }

        materialRef.current.color.copy(audioColorRef.current);
        materialRef.current.emissive.copy(audioColorRef.current);
        materialRef.current.emissiveIntensity = emissiveIntensity;
      } else {
        if (damageFlash.current > 0) {
          damageFlash.current -= delta;
          const intensity = Math.max(0, damageFlash.current / 0.3);
          materialRef.current.emissiveIntensity = intensity * 2;
          materialRef.current.color.copy(baseColorRef.current);
          materialRef.current.emissive.set(properties.color);
        } else {
          materialRef.current.emissiveIntensity = 0;
          materialRef.current.color.lerp(baseColorRef.current, 0.1);
        }
      }

      if (damageFlash.current > 0 && !audioEnabled) {
        damageFlash.current -= delta;
      }
    }

    if (audioEnabled && audioEffectsConfig.enableCollapse && !destroyed && body) {
      collapseCooldown.current = Math.max(0, collapseCooldown.current - delta);
      const { bass, treble, beatDetected, volume } = audioAnalysis;
      const { collapseThreshold } = audioEffectsConfig;

      const collapseEnergy = bass * 0.5 + volume * 0.3 + (beatDetected ? 0.4 : 0);
      const sensitivity = 0.5 + treble * 0.5;

      if (collapseEnergy > collapseThreshold && collapseCooldown.current === 0) {
        audioDamageAccum.current += collapseEnergy * sensitivity * delta * 60;
      }

      if (audioDamageAccum.current > 0) {
        audioDamageAccum.current = Math.max(0, audioDamageAccum.current - delta * 0.5);

        const damageChance = audioDamageAccum.current * 0.02;
        if (Math.random() < damageChance && collapseCooldown.current === 0) {
          const damage = materialProperties[material].health * (0.15 + bass * 0.35);
          collapseCooldown.current = 0.15;

          damageFlash.current = 0.4;
          if (damageBlockRef.current(id, damage)) {
            setDestroyed(true);
            if (meshRef.current) {
              const pos = meshRef.current.position;
              onDestroyRef.current([pos.x, pos.y, pos.z], material);
              if (spawnDebrisRef.current) {
                spawnDebrisRef.current([pos.x, pos.y, pos.z], size, material);
              }
            }
          } else {
            if (body && body.type !== CANNON.Body.DYNAMIC) {
              body.type = CANNON.Body.DYNAMIC;
            }
            body.wakeUp();
            const forceStrength = (50 + bass * 200) * (1 + blockPosHash);
            body.applyForce(
              new CANNON.Vec3(
                (Math.random() - 0.5) * forceStrength,
                forceStrength * 0.6,
                (Math.random() - 0.5) * forceStrength
              ),
              new CANNON.Vec3(
                position[0] + (Math.random() - 0.5) * size[0],
                position[1] + (Math.random() - 0.5) * size[1],
                position[2] + (Math.random() - 0.5) * size[2]
              )
            );
          }
        }
      }
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
