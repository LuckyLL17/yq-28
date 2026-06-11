import { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sky, Stars, Environment, SoftShadows } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { useGameStore, MaterialType, generateId, materialProperties } from '@/store/gameStore';
import { usePhysics } from '@/hooks/usePhysics';
import { Block } from './Block';
import { generateBuilding, generateCastle } from './BuildingGenerator';
import { Particles, ExplosionEffect, spawnParticles } from './Particles';
import { WeaponSystem, WeaponAimIndicator } from './WeaponSystem';
import { ControlPanel } from './ControlPanel';
import { DebrisSystem } from './DebrisSystem';

interface ExplosionInstance {
  id: string;
  position: [number, number, number];
  radius: number;
}

function PhysicsStepper({ step }: { step: (delta: number) => void }) {
  useFrame((_, delta) => {
    step(Math.min(delta, 1 / 30));
  });
  return null;
}

function DebugExporter() {
  const { scene, camera } = useThree();
  useEffect(() => {
    const w = window as any;
    w.__SCENE__ = scene;
    w.__CAMERA__ = camera;
    w.__USE_STORE__ = useGameStore;
  }, [scene, camera]);
  return null;
}

function Ground() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial
          color="#2a2a35"
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[30, 64]} />
        <meshStandardMaterial
          color="#3a3a4a"
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[28, 30, 64]} />
        <meshStandardMaterial
          color="#4a4a5a"
          roughness={0.7}
          emissive="#222233"
          emissiveIntensity={0.3}
        />
      </mesh>
    </>
  );
}

function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.7} color="#ffffff" />
      <directionalLight
        position={[15, 30, 15]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={100}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0001}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-30, 30, 30, -30, 0.1, 100]}
        />
      </directionalLight>
      <pointLight position={[-10, 10, -10]} intensity={0.8} color="#ffaa88" distance={60} />
      <pointLight position={[10, 12, 10]} intensity={0.6} color="#88aaff" distance={60} />
      <hemisphereLight intensity={0.6} color="#aaccff" groundColor="#667788" />
    </>
  );
}

export function GameScene() {
  const {
    blocks,
    addBlocks,
    resetGame,
    setWreckingBallActive,
  } = useGameStore();

  const {
    addBody,
    removeBody,
    getBody,
    addConstraint,
    removeConstraint,
    step,
    applyExplosion,
  } = usePhysics();

  const [explosions, setExplosions] = useState<ExplosionInstance[]>([]);
  const [buildingGenerated, setBuildingGenerated] = useState(false);
  const [rebuildCounter, setRebuildCounter] = useState(0);
  const initRef = useRef(false);
  const spawnDebrisRef = useRef<((position: [number, number, number], size: [number, number, number], material: MaterialType) => void) | null>(null);

  const handleDestroyBlock = useCallback((position: [number, number, number], material: MaterialType) => {
    requestAnimationFrame(() => {
      spawnParticles(position, material, material === 'glass' ? 25 : 15);
    });
  }, []);

  const handleSpawnDebris = useCallback((position: [number, number, number], size: [number, number, number], material: MaterialType) => {
    if (spawnDebrisRef.current) {
      spawnDebrisRef.current(position, size, material);
    }
  }, []);

  const registerSpawner = useCallback((spawner: (position: [number, number, number], size: [number, number, number], material: MaterialType) => void) => {
    spawnDebrisRef.current = spawner;
  }, []);

  const handleExplosion = useCallback((position: [number, number, number], radius: number) => {
    const id = generateId();
    setExplosions((prev) => [...prev, { id, position, radius }]);

    requestAnimationFrame(() => {
      const state = useGameStore.getState();
      const blocks = state.blocks;
      const damageBlock = state.damageBlock;
      const addParticle = state.addParticle;

      const [px, py, pz] = position;
      const damageRadius = radius * 1.5;

      blocks.forEach((block, blockId) => {
        const [bx, by, bz] = block.position;
        const dx = bx - px;
        const dy = by - py;
        const dz = bz - pz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < damageRadius) {
          const falloff = 1 - dist / damageRadius;
          const baseDamage = materialProperties[block.material].health;
          const damage = baseDamage * falloff * 2.5 + 20;

          if (damageBlock(blockId, damage)) {
            requestAnimationFrame(() => {
              spawnParticles([bx, by, bz], block.material, block.material === 'glass' ? 30 : 20);
              if (spawnDebrisRef.current) {
                spawnDebrisRef.current([bx, by, bz], block.size, block.material);
              }
            });
          }
        }
      });

      const colors = ['#ff6600', '#ffaa00', '#ff3300', '#ffff00', '#ff8844', '#ffcc00'];
      for (let i = 0; i < 100; i++) {
        const angle = Math.random() * Math.PI * 2;
        const upAngle = Math.random() * Math.PI;
        const speed = 10 + Math.random() * 25;
        const vx = Math.cos(angle) * Math.sin(upAngle) * speed;
        const vy = Math.cos(upAngle) * speed + 10;
        const vz = Math.sin(angle) * Math.sin(upAngle) * speed;

        addParticle({
          id: generateId(),
          position: [
            position[0] + (Math.random() - 0.5) * 1.5,
            position[1] + (Math.random() - 0.5) * 1.5,
            position[2] + (Math.random() - 0.5) * 1.5,
          ],
          velocity: [vx, vy, vz],
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 0.25 + Math.random() * 0.5,
          life: 2 + Math.random() * 2.5,
          maxLife: 4.5,
        });
      }

      spawnParticles(position, 'concrete', 40);
      spawnParticles(position, 'wood', 30);
    });
  }, []);

  const removeExplosion = useCallback((id: string) => {
    setExplosions((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleRegenerateBuilding = useCallback((type: 'building' | 'castle') => {
    initRef.current = false;
    setWreckingBallActive(false);
    setRebuildCounter((c) => c + 1);

    const buildingBlocks = type === 'building'
      ? generateBuilding({ width: 7, height: 5, depth: 5, blockSize: [1.2, 0.6, 1.2] })
      : generateCastle({ width: 9, height: 4, depth: 7, blockSize: [1, 0.5, 1] });

    resetGame();
    addBlocks(buildingBlocks);
    setBuildingGenerated(true);
    initRef.current = true;
  }, [resetGame, addBlocks, setWreckingBallActive]);

  const handleReset = useCallback(() => {
    initRef.current = false;
    setExplosions([]);
    setWreckingBallActive(false);
    setRebuildCounter((c) => c + 1);

    const buildingBlocks = generateBuilding({ width: 7, height: 5, depth: 5, blockSize: [1.2, 0.6, 1.2] });

    resetGame();
    addBlocks(buildingBlocks);
    setBuildingGenerated(true);
    initRef.current = true;
  }, [resetGame, addBlocks, setWreckingBallActive]);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      const buildingBlocks = generateBuilding({ width: 7, height: 5, depth: 5, blockSize: [1.2, 0.6, 1.2] });
      addBlocks(buildingBlocks);
      setBuildingGenerated(true);
    }
  }, [addBlocks]);

  const blockArray = Array.from(blocks.values());

  return (
    <div className="w-full h-screen bg-black relative overflow-hidden">
      <Canvas
        shadows
        camera={{ position: [8, 8, 15], fov: 55, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#2a2a4e']} />
        <fog attach="fog" args={['#2a2a4e', 60, 120]} />

        <SceneLighting />

        <SoftShadows size={15} samples={10} focus={0.5} />

        <DebugExporter />

        <Ground />

        {buildingGenerated && blockArray.map((block) => (
          <Block
            key={block.id}
            id={block.id}
            position={block.position}
            size={block.size}
            material={block.material}
            addPhysicsBody={addBody}
            removePhysicsBody={removeBody}
            getPhysicsBody={getBody}
            onDestroy={handleDestroyBlock}
            spawnDebris={handleSpawnDebris}
          />
        ))}

        <DebrisSystem
          addPhysicsBody={addBody}
          removePhysicsBody={removeBody}
          getPhysicsBody={getBody}
          registerSpawner={registerSpawner}
        />

        <Particles maxParticles={1000} />

        {explosions.map((explosion) => (
          <ExplosionEffect
            key={explosion.id}
            position={explosion.position}
            radius={explosion.radius}
            onComplete={() => removeExplosion(explosion.id)}
          />
        ))}

        <WeaponSystem
          addPhysicsBody={addBody}
          removePhysicsBody={removeBody}
          getPhysicsBody={getBody}
          addConstraint={addConstraint}
          removeConstraint={removeConstraint}
          applyExplosion={applyExplosion}
          onExplosion={handleExplosion}
          rebuildCounter={rebuildCounter}
        />

        <WeaponAimIndicator />

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={60}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minPolarAngle={0.1}
          makeDefault
          target={[0, 3, 0]}
        />

        <PhysicsStepper step={step} />

        <EffectComposer multisampling={8} enableNormalPass={false}>
          <Bloom
            intensity={0.6}
            luminanceThreshold={0.6}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
          <ChromaticAberration
            offset={new THREE.Vector2(0.0008, 0.0008)}
            radialModulation={false}
            modulationOffset={0}
          />
          <Vignette eskil={false} offset={0.3} darkness={0.7} />
        </EffectComposer>
      </Canvas>

      <ControlPanel
        onReset={handleReset}
        onRegenerateBuilding={handleRegenerateBuilding}
      />
    </div>
  );
}

export default GameScene;
