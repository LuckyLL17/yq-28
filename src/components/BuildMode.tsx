import { useRef, useState, useCallback, useEffect } from 'react';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, MaterialType, materialProperties, generateId, BlockData, BuildTool } from '@/store/gameStore';

const GRID_SIZE = 1;
const GRID_HALF = 20;
const BLOCK_HEIGHT = 1;
const ROTATION_STEP = Math.PI / 2;

function BuildGrid() {
  const linesRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!linesRef.current) return;
    const group = linesRef.current;
    const material = new THREE.LineBasicMaterial({
      color: '#4a5568',
      transparent: true,
      opacity: 0.3,
    });

    for (let i = -GRID_HALF; i <= GRID_HALF; i += GRID_SIZE) {
      const points1 = [new THREE.Vector3(i, 0.01, -GRID_HALF), new THREE.Vector3(i, 0.01, GRID_HALF)];
      const geo1 = new THREE.BufferGeometry().setFromPoints(points1);
      group.add(new THREE.Line(geo1, material));

      const points2 = [new THREE.Vector3(-GRID_HALF, 0.01, i), new THREE.Vector3(GRID_HALF, 0.01, i)];
      const geo2 = new THREE.BufferGeometry().setFromPoints(points2);
      group.add(new THREE.Line(geo2, material));
    }

    return () => {
      while (group.children.length > 0) {
        const child = group.children[0];
        if (child instanceof THREE.Line) {
          child.geometry.dispose();
        }
        group.remove(child);
      }
    };
  }, []);

  return <group ref={linesRef} />;
}

function GhostBlock() {
  const buildMaterial = useGameStore((s) => s.buildMaterial);
  const buildTool = useGameStore((s) => s.buildTool);
  const [ghostPos, setGhostPos] = useState<[number, number, number] | null>(null);
  const [ghostRotation, setGhostRotation] = useState<[number, number, number]>([0, 0, 0]);
  const { camera, raycaster, pointer, scene } = useThree();
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const intersectionPoint = useRef(new THREE.Vector3());
  const lastPointer = useRef({ x: 0, y: 0 });

  useFrame(() => {
    if (buildTool !== 'place') {
      setGhostPos(null);
      return;
    }

    if (Math.abs(pointer.x - lastPointer.current.x) < 0.001 && Math.abs(pointer.y - lastPointer.current.y) < 0.001) {
      return;
    }
    lastPointer.current = { x: pointer.x, y: pointer.y };

    raycaster.setFromCamera(pointer, camera);
    const ray = raycaster.ray;

    if (ray.intersectPlane(groundPlane.current, intersectionPoint.current)) {
      const snappedX = Math.round(intersectionPoint.current.x / GRID_SIZE) * GRID_SIZE;
      const snappedZ = Math.round(intersectionPoint.current.z / GRID_SIZE) * GRID_SIZE;
      const snappedY = findStackHeight(snappedX, snappedZ);
      setGhostPos([snappedX, snappedY, snappedZ]);
      setGhostRotation([0, 0, 0]);
    }
  });

  const properties = materialProperties[buildMaterial];
  const isGlass = buildMaterial === 'glass';

  if (!ghostPos) return null;

  return (
    <mesh position={ghostPos} rotation={ghostRotation}>
      <boxGeometry args={[GRID_SIZE * 0.95, BLOCK_HEIGHT * 0.95, GRID_SIZE * 0.95]} />
      <meshStandardMaterial
        color={properties.color}
        transparent
        opacity={isGlass ? 0.3 : 0.4}
        roughness={0.5}
        depthWrite={false}
      />
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(GRID_SIZE * 0.95, BLOCK_HEIGHT * 0.95, GRID_SIZE * 0.95)]} />
        <lineBasicMaterial color="#ffffff" transparent opacity={0.6} />
      </lineSegments>
    </mesh>
  );
}

function findStackHeight(x: number, z: number): number {
  const blocks = useGameStore.getState().blocks;
  let maxY = BLOCK_HEIGHT / 2;
  blocks.forEach((block) => {
    const [bx, by, bz] = block.position;
    const halfH = (block.size[1]) / 2;
    if (Math.abs(bx - x) < 0.5 && Math.abs(bz - z) < 0.5) {
      const blockTop = by + halfH;
      if (blockTop > maxY - BLOCK_HEIGHT / 2 + 0.1) {
        maxY = Math.max(maxY, by + halfH + BLOCK_HEIGHT / 2);
      }
    }
  });
  return maxY;
}

function BuildBlock({ block, isSelected }: { block: BlockData; isSelected: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const outlineRef = useRef<THREE.LineSegments>(null);
  const buildTool = useGameStore((s) => s.buildTool);
  const selectedBlockId = useGameStore((s) => s.selectedBlockId);
  const setSelectedBlockId = useGameStore((s) => s.setSelectedBlockId);
  const setBuildTool = useGameStore((s) => s.setBuildTool);
  const properties = materialProperties[block.material];
  const isGlass = block.material === 'glass';
  const rotation = block.rotation || [0, 0, 0];
  const isDragMoving = useRef(false);
  const dragStart = useRef<[number, number, number] | null>(null);
  const movePlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -block.position[1]));
  const { camera, raycaster, pointer } = useThree();
  const intersectionPoint = useRef(new THREE.Vector3());
  const updateBlockPosition = useGameStore((s) => s.updateBlockPosition);
  const pushUndoAction = useGameStore((s) => s.pushUndoAction);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (buildTool === 'delete') {
      const blocks = useGameStore.getState().blocks;
      const blockData = blocks.get(block.id);
      if (blockData) {
        useGameStore.getState().removeBlock(block.id);
        pushUndoAction({ type: 'remove', block: { ...blockData } });
      }
      return;
    }
    if (buildTool === 'move' || buildTool === 'rotate') {
      setSelectedBlockId(isSelected ? null : block.id);
      return;
    }
    setSelectedBlockId(block.id);
  }, [block.id, buildTool, isSelected, setSelectedBlockId, pushUndoAction]);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (buildTool !== 'move' || !isSelected) return;
    e.stopPropagation();
    isDragMoving.current = true;
    dragStart.current = [...block.position];
    movePlaneRef.current.set(new THREE.Vector3(0, 1, 0), -block.position[1]);
  }, [buildTool, isSelected, block.position]);

  const handlePointerUp = useCallback(() => {
    if (!isDragMoving.current || !dragStart.current) return;
    isDragMoving.current = false;
    const fromPos = dragStart.current;
    const toPos = [...block.position] as [number, number, number];
    if (fromPos[0] !== toPos[0] || fromPos[1] !== toPos[1] || fromPos[2] !== toPos[2]) {
      pushUndoAction({
        type: 'move',
        blockId: block.id,
        fromPosition: fromPos,
        toPosition: toPos,
      });
    }
    dragStart.current = null;
  }, [block.id, block.position, pushUndoAction]);

  useFrame(() => {
    if (isDragMoving.current && buildTool === 'move' && isSelected) {
      raycaster.setFromCamera(pointer, camera);
      const ray = raycaster.ray;
      if (ray.intersectPlane(movePlaneRef.current, intersectionPoint.current)) {
        const snappedX = Math.round(intersectionPoint.current.x / GRID_SIZE) * GRID_SIZE;
        const snappedZ = Math.round(intersectionPoint.current.z / GRID_SIZE) * GRID_SIZE;
        const newY = findStackHeight(snappedX, snappedZ);
        if (snappedX !== block.position[0] || newY !== block.position[1] || snappedZ !== block.position[2]) {
          updateBlockPosition(block.id, [snappedX, newY, snappedZ]);
        }
      }
    }
  });

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isDragMoving.current) {
        handlePointerUp();
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [handlePointerUp]);

  return (
    <group>
      <mesh
        ref={meshRef}
        position={block.position}
        rotation={rotation}
        castShadow
        receiveShadow
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <boxGeometry args={block.size} />
        <meshStandardMaterial
          color={properties.color}
          transparent={isGlass}
          opacity={isGlass ? 0.6 : 1}
          roughness={block.material === 'wood' ? 0.8 : block.material === 'concrete' ? 0.9 : 0.1}
          metalness={block.material === 'concrete' ? 0.1 : block.material === 'glass' ? 0.9 : 0.05}
          emissive={properties.color}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>
      {isSelected && (
        <lineSegments
          ref={outlineRef}
          position={block.position}
          rotation={rotation}
        >
          <edgesGeometry args={[new THREE.BoxGeometry(block.size[0] * 1.02, block.size[1] * 1.02, block.size[2] * 1.02)]} />
          <lineBasicMaterial color="#00ff88" linewidth={2} />
        </lineSegments>
      )}
    </group>
  );
}

function PlacementHandler() {
  const buildTool = useGameStore((s) => s.buildTool);
  const buildMaterial = useGameStore((s) => s.buildMaterial);
  const addBlock = useGameStore((s) => s.addBlock);
  const pushUndoAction = useGameStore((s) => s.pushUndoAction);
  const { camera, raycaster, pointer } = useThree();
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const intersectionPoint = useRef(new THREE.Vector3());

  const handleGroundClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (buildTool !== 'place') return;
    e.stopPropagation();

    raycaster.setFromCamera(pointer, camera);
    const ray = raycaster.ray;
    if (ray.intersectPlane(groundPlane.current, intersectionPoint.current)) {
      const snappedX = Math.round(intersectionPoint.current.x / GRID_SIZE) * GRID_SIZE;
      const snappedZ = Math.round(intersectionPoint.current.z / GRID_SIZE) * GRID_SIZE;
      const snappedY = findStackHeight(snappedX, snappedZ);

      const properties = materialProperties[buildMaterial];
      const block: BlockData = {
        id: generateId(),
        position: [snappedX, snappedY, snappedZ],
        size: [GRID_SIZE * 0.95, BLOCK_HEIGHT * 0.95, GRID_SIZE * 0.95],
        material: buildMaterial,
        health: properties.health,
        maxHealth: properties.health,
        rotation: [0, 0, 0],
      };

      addBlock(block);
      pushUndoAction({ type: 'add', block });
    }
  }, [buildTool, buildMaterial, addBlock, pushUndoAction, camera, raycaster, pointer]);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.005, 0]}
      onClick={handleGroundClick}
      visible={false}
    >
      <planeGeometry args={[GRID_HALF * 2, GRID_HALF * 2]} />
      <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

function KeyboardHandler() {
  const selectedBlockId = useGameStore((s) => s.selectedBlockId);
  const buildTool = useGameStore((s) => s.buildTool);
  const blocks = useGameStore((s) => s.blocks);
  const updateBlockRotation = useGameStore((s) => s.updateBlockRotation);
  const pushUndoAction = useGameStore((s) => s.pushUndoAction);
  const undo = useGameStore((s) => s.undo);
  const redo = useGameStore((s) => s.redo);
  const setSelectedBlockId = useGameStore((s) => s.setSelectedBlockId);
  const removeBlock = useGameStore((s) => s.removeBlock);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
        e.preventDefault();
        redo();
        return;
      }

      if (!selectedBlockId) return;
      const block = blocks.get(selectedBlockId);
      if (!block) return;

      if (e.key === 'r' || e.key === 'R') {
        const currentRot = block.rotation || [0, 0, 0];
        const newRot: [number, number, number] = [currentRot[0], currentRot[1] + ROTATION_STEP, currentRot[2]];
        const fromRotation = [...currentRot] as [number, number, number];
        updateBlockRotation(selectedBlockId, newRot);
        pushUndoAction({ type: 'rotate', blockId: selectedBlockId, fromRotation, toRotation: newRot });
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const blockData = blocks.get(selectedBlockId);
        if (blockData) {
          removeBlock(selectedBlockId);
          pushUndoAction({ type: 'remove', block: { ...blockData } });
          setSelectedBlockId(null);
        }
      }

      if (e.key === 'Escape') {
        setSelectedBlockId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockId, blocks, updateBlockRotation, pushUndoAction, undo, redo, removeBlock, setSelectedBlockId]);

  return null;
}

function BuildGround() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[GRID_HALF * 2, GRID_HALF * 2]} />
        <meshStandardMaterial color="#2a3a2a" roughness={0.9} metalness={0.1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[GRID_HALF * 0.8, 64]} />
        <meshStandardMaterial color="#3a4a3a" roughness={0.8} metalness={0.1} />
      </mesh>
    </>
  );
}

export function BuildMode() {
  const blocks = useGameStore((s) => s.blocks);
  const selectedBlockId = useGameStore((s) => s.selectedBlockId);
  const buildTool = useGameStore((s) => s.buildTool);

  const blockArray = Array.from(blocks.values());

  return (
    <>
      <BuildGround />
      <BuildGrid />
      <GhostBlock />
      <PlacementHandler />
      <KeyboardHandler />

      {blockArray.map((block) => (
        <BuildBlock
          key={block.id}
          block={block}
          isSelected={block.id === selectedBlockId}
        />
      ))}

      {selectedBlockId && buildTool === 'rotate' && (
        <RotateGizmo blockId={selectedBlockId} />
      )}
    </>
  );
}

function RotateGizmo({ blockId }: { blockId: string }) {
  const blocks = useGameStore((s) => s.blocks);
  const updateBlockRotation = useGameStore((s) => s.updateBlockRotation);
  const pushUndoAction = useGameStore((s) => s.pushUndoAction);
  const block = blocks.get(blockId);
  const [hovered, setHovered] = useState<string | null>(null);

  if (!block) return null;

  const position = block.position;
  const currentRot = block.rotation || [0, 0, 0];

  const arrows = [
    { axis: 'y+', color: '#00ff88', rotation: [0, 0, -Math.PI / 2] as [number, number, number], offset: [0, 0, 1.2] as [number, number, number] },
    { axis: 'y-', color: '#ff8800', rotation: [0, 0, Math.PI / 2] as [number, number, number], offset: [0, 0, -1.2] as [number, number, number] },
    { axis: 'x+', color: '#0088ff', rotation: [0, Math.PI / 2, 0] as [number, number, number], offset: [1.2, 0, 0] as [number, number, number] },
    { axis: 'x-', color: '#ff0088', rotation: [0, -Math.PI / 2, 0] as [number, number, number], offset: [-1.2, 0, 0] as [number, number, number] },
  ];

  const handleRotate = (axis: string) => {
    const fromRotation = [...currentRot] as [number, number, number];
    const newRot: [number, number, number] = [...currentRot] as [number, number, number];

    if (axis === 'y+' || axis === 'y-') {
      newRot[1] += axis === 'y+' ? ROTATION_STEP : -ROTATION_STEP;
    } else if (axis === 'x+' || axis === 'x-') {
      newRot[0] += axis === 'x+' ? ROTATION_STEP : -ROTATION_STEP;
    }

    updateBlockRotation(blockId, newRot);
    pushUndoAction({ type: 'rotate', blockId, fromRotation, toRotation: newRot });
  };

  return (
    <group position={position}>
      {arrows.map((arrow) => (
        <group
          key={arrow.axis}
          position={arrow.offset}
          rotation={arrow.rotation}
          onClick={(e) => {
            e.stopPropagation();
            handleRotate(arrow.axis);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(arrow.axis);
          }}
          onPointerOut={() => setHovered(null)}
        >
          <mesh>
            <coneGeometry args={[0.2, 0.5, 8]} />
            <meshStandardMaterial
              color={hovered === arrow.axis ? '#ffffff' : arrow.color}
              emissive={arrow.color}
              emissiveIntensity={hovered === arrow.axis ? 1 : 0.3}
            />
          </mesh>
          <mesh position={[0, -0.4, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.8, 8]} />
            <meshStandardMaterial
              color={arrow.color}
              emissive={arrow.color}
              emissiveIntensity={0.2}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default BuildMode;
