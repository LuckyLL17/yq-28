import { useRef, useState, useCallback, useEffect } from 'react';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { create } from 'zustand';
import * as THREE from 'three';
import { useGameStore, materialProperties, generateId, BlockData } from '@/store/gameStore';

const GRID_SIZE = 1;
const GRID_HALF = 20;
const BLOCK_HEIGHT = 1;
const BLOCK_UNIT = BLOCK_HEIGHT * 0.95;
const HALF_BLOCK = BLOCK_UNIT / 2;
const ROTATION_STEP = Math.PI / 2;
const MAX_HEIGHT_LEVEL = 30;

interface BuildHeightState {
  heightLevel: number;
  setHeightLevel: (level: number) => void;
  incHeight: () => void;
  decHeight: () => void;
}

const useBuildHeightLevel = create<BuildHeightState>((set, get) => ({
  heightLevel: 0,
  setHeightLevel: (level) => set({ heightLevel: Math.max(0, Math.min(MAX_HEIGHT_LEVEL, level)) }),
  incHeight: () => set({ heightLevel: Math.min(MAX_HEIGHT_LEVEL, get().heightLevel + 1) }),
  decHeight: () => set({ heightLevel: Math.max(0, get().heightLevel - 1) }),
}));

function BuildGrid() {
  const linesRef = useRef<THREE.Group>(null);
  const buildTool = useGameStore((s) => s.buildTool);
  const heightLevel = useBuildHeightLevel((s) => s.heightLevel);

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

  const levelY = heightLevel * BLOCK_UNIT + 0.01;

  return (
    <>
      <group ref={linesRef} />
      {(buildTool === 'place' || buildTool === 'move') && heightLevel > 0 && (
        <group position={[0, levelY, 0]}>
          <gridHelper args={[GRID_HALF * 2, GRID_HALF * 2, 0x4a5568, 0x4a5568]} />
        </group>
      )}
    </>
  );
}

function GhostBlock() {
  const buildMaterial = useGameStore((s) => s.buildMaterial);
  const buildTool = useGameStore((s) => s.buildTool);
  const heightLevel = useBuildHeightLevel((s) => s.heightLevel);
  const [ghostPos, setGhostPos] = useState<[number, number, number] | null>(null);
  const [isColliding, setIsColliding] = useState(false);
  const { camera, raycaster, pointer, scene } = useThree();
  const intersectionPoint = useRef(new THREE.Vector3());
  const lastPointer = useRef({ x: 0, y: 0 });
  const lastHeight = useRef(0);
  const heightPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

  useFrame(() => {
    if (buildTool !== 'place') {
      setGhostPos(null);
      setIsColliding(false);
      return;
    }

    const pointerMoved = Math.abs(pointer.x - lastPointer.current.x) > 0.001 || Math.abs(pointer.y - lastPointer.current.y) > 0.001;
    const heightChanged = heightLevel !== lastHeight.current;

    if (!pointerMoved && !heightChanged) {
      return;
    }
    lastPointer.current = { x: pointer.x, y: pointer.y };
    lastHeight.current = heightLevel;

    raycaster.setFromCamera(pointer, camera);

    const buildMeshes: THREE.Mesh[] = [];
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData?.isBuildBlock) {
        buildMeshes.push(obj);
      }
    });

    const hits = raycaster.intersectObjects(buildMeshes, false);
    let hitPoint: THREE.Vector3 | null = null;
    let hitFaceNormal: THREE.Vector3 | null = null;

    if (hits.length > 0) {
      hitPoint = hits[0].point;
      hitFaceNormal = hits[0].face?.normal?.clone() || null;
      if (hitFaceNormal) {
        hitFaceNormal.transformDirection(hits[0].object.matrixWorld);
      }
    }

    let newPos: [number, number, number] | null = null;

    if (hitPoint && hitFaceNormal) {
      const snappedX = Math.round(hitPoint.x / GRID_SIZE) * GRID_SIZE;
      const snappedZ = Math.round(hitPoint.z / GRID_SIZE) * GRID_SIZE;

      if (Math.abs(hitFaceNormal.y) > 0.5) {
        if (hitFaceNormal.y > 0) {
          const stackY = findStackHeight(snappedX, snappedZ);
          newPos = [snappedX, stackY, snappedZ];
        } else {
          const belowY = Math.floor(hitPoint.y / BLOCK_UNIT) * BLOCK_UNIT + HALF_BLOCK;
          newPos = [snappedX, Math.max(HALF_BLOCK, belowY - BLOCK_UNIT), snappedZ];
        }
      } else {
        const offsetX = hitFaceNormal.x > 0 ? GRID_SIZE : hitFaceNormal.x < 0 ? -GRID_SIZE : 0;
        const offsetZ = hitFaceNormal.z > 0 ? GRID_SIZE : hitFaceNormal.z < 0 ? -GRID_SIZE : 0;
        const targetX = snappedX + offsetX;
        const targetZ = snappedZ + offsetZ;
        const stackY = findStackHeight(targetX, targetZ);
        newPos = [targetX, stackY, targetZ];
      }
    } else {
      heightPlane.current.set(new THREE.Vector3(0, 1, 0), -(heightLevel * BLOCK_UNIT + HALF_BLOCK));
      if (raycaster.ray.intersectPlane(heightPlane.current, intersectionPoint.current)) {
        const snappedX = Math.round(intersectionPoint.current.x / GRID_SIZE) * GRID_SIZE;
        const snappedZ = Math.round(intersectionPoint.current.z / GRID_SIZE) * GRID_SIZE;
        const snappedY = heightLevel * BLOCK_UNIT + HALF_BLOCK;
        newPos = [snappedX, snappedY, snappedZ];
      }
    }

    if (newPos) {
      const colliding = checkCollision(newPos, [BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT]);
      setGhostPos(newPos);
      setIsColliding(colliding);
    } else {
      setGhostPos(null);
      setIsColliding(false);
    }
  });

  const properties = materialProperties[buildMaterial];
  const isGlass = buildMaterial === 'glass';

  if (!ghostPos) return null;

  const displayColor = isColliding ? '#ff3333' : properties.color;
  const edgeColor = isColliding ? '#ff6666' : '#ffffff';

  return (
    <mesh position={ghostPos}>
      <boxGeometry args={[BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT]} />
      <meshStandardMaterial
        color={displayColor}
        transparent
        opacity={isGlass ? 0.3 : 0.4}
        roughness={0.5}
        depthWrite={false}
        emissive={isColliding ? '#ff0000' : '#000000'}
        emissiveIntensity={isColliding ? 0.3 : 0}
      />
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT)]} />
        <lineBasicMaterial color={edgeColor} transparent opacity={0.8} />
      </lineSegments>
    </mesh>
  );
}

function findStackHeight(x: number, z: number, excludeId?: string): number {
  const blocks = useGameStore.getState().blocks;
  let maxTop = 0;

  blocks.forEach((block, id) => {
    if (excludeId && id === excludeId) return;
    const [bx, by, bz] = block.position;
    const halfW = block.size[0] / 2;
    const halfH = block.size[1] / 2;
    const halfD = block.size[2] / 2;

    if (Math.abs(bx - x) < halfW + 0.25 && Math.abs(bz - z) < halfD + 0.25) {
      const blockTop = by + halfH;
      if (blockTop > maxTop) {
        maxTop = blockTop;
      }
    }
  });

  return maxTop + HALF_BLOCK;
}

function checkCollision(position: [number, number, number], size: [number, number, number], excludeId?: string): boolean {
  const blocks = useGameStore.getState().blocks;
  const [px, py, pz] = position;
  const halfW = size[0] / 2;
  const halfH = size[1] / 2;
  const halfD = size[2] / 2;

  for (const [id, block] of blocks.entries()) {
    if (excludeId && id === excludeId) continue;
    const [bx, by, bz] = block.position;
    const bHalfW = block.size[0] / 2;
    const bHalfH = block.size[1] / 2;
    const bHalfD = block.size[2] / 2;

    if (
      Math.abs(bx - px) < halfW + bHalfW - 0.001 &&
      Math.abs(by - py) < halfH + bHalfH - 0.001 &&
      Math.abs(bz - pz) < halfD + bHalfD - 0.001
    ) {
      return true;
    }
  }

  return false;
}

function BuildBlock({ block, isSelected }: { block: BlockData; isSelected: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const outlineRef = useRef<THREE.LineSegments>(null);
  const buildTool = useGameStore((s) => s.buildTool);
  const buildMaterial = useGameStore((s) => s.buildMaterial);
  const setSelectedBlockId = useGameStore((s) => s.setSelectedBlockId);
  const addBlock = useGameStore((s) => s.addBlock);
  const pushUndoAction = useGameStore((s) => s.pushUndoAction);
  const heightLevel = useBuildHeightLevel((s) => s.heightLevel);
  const properties = materialProperties[block.material];
  const isGlass = block.material === 'glass';
  const rotation = block.rotation || [0, 0, 0];
  const isDragMoving = useRef(false);
  const dragStart = useRef<[number, number, number] | null>(null);
  const movePlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -block.position[1]));
  const lastPointer = useRef({ x: 0, y: 0 });
  const lastHeightLevel = useRef(0);
  const dragBaseX = useRef(0);
  const dragBaseZ = useRef(0);
  const { camera, raycaster, pointer } = useThree();
  const intersectionPoint = useRef(new THREE.Vector3());
  const updateBlockPosition = useGameStore((s) => s.updateBlockPosition);

  const placeOnTop = useCallback(() => {
    const [bx, by, bz] = block.position;
    const halfH = block.size[1] / 2;
    const newY = by + halfH + HALF_BLOCK;
    const newPos: [number, number, number] = [bx, newY, bz];
    if (checkCollision(newPos, [BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT])) return;
    const props = materialProperties[buildMaterial];
    const newBlock: BlockData = {
      id: generateId(),
      position: newPos,
      size: [BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT],
      material: buildMaterial,
      health: props.health,
      maxHealth: props.health,
      rotation: [0, 0, 0],
    };
    addBlock(newBlock);
    pushUndoAction({ type: 'add', block: { ...newBlock } });
  }, [block.position, block.size, buildMaterial, addBlock, pushUndoAction]);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (buildTool === 'place') {
      const hit = e.intersections[0];
      if (hit?.face?.normal) {
        const normal = hit.face.normal.clone();
        normal.transformDirection(hit.object.matrixWorld);
        const [bx, by, bz] = block.position;
        const props = materialProperties[buildMaterial];

        let placeX = bx;
        let placeY = by;
        let placeZ = bz;

        if (normal.y > 0.5) {
          placeY = findStackHeight(bx, bz);
        } else if (normal.y < -0.5) {
          const stackBelow = findStackHeight(bx, bz, block.id);
          const belowY = stackBelow - BLOCK_UNIT;
          placeY = Math.max(HALF_BLOCK, belowY);
        } else {
          if (Math.abs(normal.x) > Math.abs(normal.z)) {
            placeX = bx + Math.sign(normal.x) * GRID_SIZE;
          } else {
            placeZ = bz + Math.sign(normal.z) * GRID_SIZE;
          }
          placeY = findStackHeight(placeX, placeZ);
        }

        const placePos: [number, number, number] = [placeX, placeY, placeZ];
        if (checkCollision(placePos, [BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT])) return;

        const newBlock: BlockData = {
          id: generateId(),
          position: placePos,
          size: [BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT],
          material: buildMaterial,
          health: props.health,
          maxHealth: props.health,
          rotation: [0, 0, 0],
        };
        addBlock(newBlock);
        pushUndoAction({ type: 'add', block: { ...newBlock } });
      } else {
        placeOnTop();
      }
      return;
    }
    if (buildTool === 'delete') {
      const blockMap = useGameStore.getState().blocks;
      const blockData = blockMap.get(block.id);
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
  }, [block.id, block.position, block.size, buildTool, buildMaterial, isSelected, setSelectedBlockId, pushUndoAction, addBlock, placeOnTop]);

  const setHeightLevel = useBuildHeightLevel((s) => s.setHeightLevel);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (buildTool !== 'move' || !isSelected) return;
    e.stopPropagation();
    isDragMoving.current = true;
    dragStart.current = [...block.position] as [number, number, number];
    const currentBlockLevel = Math.max(0, Math.round((block.position[1] - HALF_BLOCK) / BLOCK_UNIT));
    setHeightLevel(currentBlockLevel);
    const planeY = currentBlockLevel * BLOCK_UNIT + HALF_BLOCK;
    movePlaneRef.current.set(new THREE.Vector3(0, 1, 0), -planeY);
    lastPointer.current = { x: pointer.x, y: pointer.y };
    lastHeightLevel.current = currentBlockLevel;
    dragBaseX.current = block.position[0];
    dragBaseZ.current = block.position[2];
  }, [buildTool, isSelected, block.position, setHeightLevel, pointer]);

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
      const pointerMoved = Math.abs(pointer.x - lastPointer.current.x) > 0.001 || Math.abs(pointer.y - lastPointer.current.y) > 0.001;
      const heightChanged = heightLevel !== lastHeightLevel.current;

      if (pointerMoved) {
        raycaster.setFromCamera(pointer, camera);
        const ray = raycaster.ray;
        const planeY = heightLevel * BLOCK_UNIT + HALF_BLOCK;
        movePlaneRef.current.set(new THREE.Vector3(0, 1, 0), -planeY);
        if (ray.intersectPlane(movePlaneRef.current, intersectionPoint.current)) {
          const snappedX = Math.round(intersectionPoint.current.x / GRID_SIZE) * GRID_SIZE;
          const snappedZ = Math.round(intersectionPoint.current.z / GRID_SIZE) * GRID_SIZE;
          const snappedY = heightLevel * BLOCK_UNIT + HALF_BLOCK;
          if (snappedX !== block.position[0] || Math.abs(snappedY - block.position[1]) > 0.001 || snappedZ !== block.position[2]) {
            if (!checkCollision([snappedX, snappedY, snappedZ], [BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT], block.id)) {
              updateBlockPosition(block.id, [snappedX, snappedY, snappedZ]);
              dragBaseX.current = snappedX;
              dragBaseZ.current = snappedZ;
            }
          }
        }
        lastPointer.current = { x: pointer.x, y: pointer.y };
      } else if (heightChanged) {
        const snappedY = heightLevel * BLOCK_UNIT + HALF_BLOCK;
        const newX = dragBaseX.current;
        const newZ = dragBaseZ.current;
        if (Math.abs(snappedY - block.position[1]) > 0.001 || newX !== block.position[0] || newZ !== block.position[2]) {
          if (!checkCollision([newX, snappedY, newZ], [BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT], block.id)) {
            updateBlockPosition(block.id, [newX, snappedY, newZ]);
          }
        }
      }

      lastHeightLevel.current = heightLevel;
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
        userData={{ isBuildBlock: true, blockId: block.id }}
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
          <lineBasicMaterial color="#00ff88" />
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
  const heightLevel = useBuildHeightLevel((s) => s.heightLevel);
  const { camera, raycaster, pointer } = useThree();
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const intersectionPoint = useRef(new THREE.Vector3());

  const handleGroundClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (buildTool !== 'place') return;
    e.stopPropagation();

    raycaster.setFromCamera(pointer, camera);
    const ray = raycaster.ray;

    if (heightLevel === 0) {
      groundPlane.current.set(new THREE.Vector3(0, 1, 0), 0);
    } else {
      groundPlane.current.set(new THREE.Vector3(0, 1, 0), -(heightLevel * BLOCK_UNIT + HALF_BLOCK));
    }

    if (ray.intersectPlane(groundPlane.current, intersectionPoint.current)) {
      const snappedX = Math.round(intersectionPoint.current.x / GRID_SIZE) * GRID_SIZE;
      const snappedZ = Math.round(intersectionPoint.current.z / GRID_SIZE) * GRID_SIZE;
      const snappedY = findStackHeight(snappedX, snappedZ);
      const finalY = heightLevel > 0 ? Math.max(snappedY, heightLevel * BLOCK_UNIT + HALF_BLOCK) : snappedY;
      const finalPos: [number, number, number] = [snappedX, finalY, snappedZ];

      if (checkCollision(finalPos, [BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT])) return;

      const properties = materialProperties[buildMaterial];
      const placedBlock: BlockData = {
        id: generateId(),
        position: finalPos,
        size: [BLOCK_UNIT, BLOCK_UNIT, BLOCK_UNIT],
        material: buildMaterial,
        health: properties.health,
        maxHealth: properties.health,
        rotation: [0, 0, 0],
      };

      addBlock(placedBlock);
      pushUndoAction({ type: 'add', block: { ...placedBlock } });
    }
  }, [buildTool, buildMaterial, addBlock, pushUndoAction, camera, raycaster, pointer, heightLevel]);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.1, 0]}
      onClick={handleGroundClick}
    >
      <planeGeometry args={[GRID_HALF * 2, GRID_HALF * 2]} />
      <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function KeyboardHandler() {
  const selectedBlockId = useGameStore((s) => s.selectedBlockId);
  const blocks = useGameStore((s) => s.blocks);
  const buildTool = useGameStore((s) => s.buildTool);
  const updateBlockRotation = useGameStore((s) => s.updateBlockRotation);
  const pushUndoAction = useGameStore((s) => s.pushUndoAction);
  const undo = useGameStore((s) => s.undo);
  const redo = useGameStore((s) => s.redo);
  const setSelectedBlockId = useGameStore((s) => s.setSelectedBlockId);
  const removeBlock = useGameStore((s) => s.removeBlock);
  const updateBlockPosition = useGameStore((s) => s.updateBlockPosition);
  const incHeight = useBuildHeightLevel((s) => s.incHeight);
  const decHeight = useBuildHeightLevel((s) => s.decHeight);
  const setHeightLevel = useBuildHeightLevel((s) => s.setHeightLevel);

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

      if (buildTool === 'place' || buildTool === 'move') {
        if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          incHeight();
          return;
        }
        if (e.key === 'q' || e.key === 'Q') {
          e.preventDefault();
          decHeight();
          return;
        }
        if (e.key === '0') {
          e.preventDefault();
          setHeightLevel(0);
          return;
        }
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

      if (buildTool === 'move') {
        const [px, py, pz] = block.position;
        const fromPos = [...block.position] as [number, number, number];
        let moved = false;
        let toPos: [number, number, number] = [px, py, pz];

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          toPos = [px, py, pz - GRID_SIZE];
          moved = true;
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          toPos = [px, py, pz + GRID_SIZE];
          moved = true;
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          toPos = [px - GRID_SIZE, py, pz];
          moved = true;
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          toPos = [px + GRID_SIZE, py, pz];
          moved = true;
        } else if (e.key === 'PageUp') {
          e.preventDefault();
          toPos = [px, py + BLOCK_UNIT, pz];
          moved = true;
        } else if (e.key === 'PageDown') {
          e.preventDefault();
          toPos = [px, Math.max(HALF_BLOCK, py - BLOCK_UNIT), pz];
          moved = true;
        }

        if (moved) {
          toPos[0] = Math.max(-GRID_HALF, Math.min(GRID_HALF, toPos[0]));
          toPos[2] = Math.max(-GRID_HALF, Math.min(GRID_HALF, toPos[2]));
          if (!checkCollision(toPos, block.size, selectedBlockId)) {
            updateBlockPosition(selectedBlockId, toPos);
            pushUndoAction({ type: 'move', blockId: selectedBlockId, fromPosition: fromPos, toPosition: toPos });
          }
          return;
        }
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
  }, [selectedBlockId, blocks, buildTool, updateBlockRotation, pushUndoAction, undo, redo, removeBlock, setSelectedBlockId, updateBlockPosition, incHeight, decHeight, setHeightLevel]);

  return null;
}

function BuildGround() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[GRID_HALF * 2, GRID_HALF * 2]} />
        <meshStandardMaterial color="#2a3a2a" roughness={0.9} metalness={0.1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
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

      <HeightLevelIndicator />
    </>
  );
}

function HeightLevelIndicator() {
  const heightLevel = useBuildHeightLevel((s) => s.heightLevel);
  const buildTool = useGameStore((s) => s.buildTool);

  if (buildTool !== 'place' && buildTool !== 'move') return null;

  return (
    <group position={[-GRID_HALF + 1, heightLevel * BLOCK_UNIT + HALF_BLOCK, -GRID_HALF + 1]}>
      <mesh>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial
          color={heightLevel === 0 ? '#88ff88' : '#ffaa44'}
          emissive={heightLevel === 0 ? '#00ff00' : '#ff6600'}
          emissiveIntensity={0.8}
        />
      </mesh>
    </group>
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
