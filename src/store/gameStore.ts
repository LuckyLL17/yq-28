import { create } from 'zustand';
import * as CANNON from 'cannon-es';

export type WeaponType = 'wreckingBall' | 'steelBall' | 'explosive' | 'sprayPaint';

export type WeaponUpgradeKey = 'damage' | 'speed' | 'radius';

export interface WeaponUpgradeLevels {
  damage: number;
  speed: number;
  radius: number;
}

export type WeaponAppearanceKey = 'mainColor' | 'trailColor' | 'glowColor' | 'effectType';

export type WeaponEffectType = 'none' | 'fire' | 'electric' | 'rainbow' | 'shadow';

export interface WeaponAppearance {
  mainColor: string;
  trailColor: string;
  glowColor: string;
  effectType: WeaponEffectType;
}

export type WeaponCustomizations = Record<WeaponType, {
  upgrades: WeaponUpgradeLevels;
  appearance: WeaponAppearance;
}>;
export type MaterialType = 'wood' | 'glass' | 'concrete';
export type GameMode = 'destroy' | 'build' | 'roboticArm' | 'physicsLab';
export type BuildTool = 'place' | 'move' | 'rotate' | 'delete' | 'sprayPaint';
export type GravityDirection = 'down' | 'up' | 'left' | 'right' | 'forward' | 'backward';
export type ConstraintType = 'spring' | 'rope' | 'hinge' | 'pulley' | 'distance';
export type LabObjectType = 'box' | 'sphere' | 'cylinder' | 'groundAnchor' | 'weight';
export type LabTool = 'placeObject' | 'placeConstraint' | 'select' | 'delete' | 'move';

export const GRAVITY_VECTORS: Record<GravityDirection, [number, number, number]> = {
  down: [0, -30, 0],
  up: [0, 30, 0],
  left: [-30, 0, 0],
  right: [30, 0, 0],
  forward: [0, 0, 30],
  backward: [0, 0, -30],
};

export const GRAVITY_LABELS: Record<GravityDirection, string> = {
  down: '↓ 向下',
  up: '↑ 向上',
  left: '← 向左',
  right: '→ 向右',
  forward: '⦿ 向前',
  backward: '⊗ 向后',
};

export interface SprayPoint {
  x: number;
  y: number;
  face: string;
  color: string;
  size: number;
}

export interface BlockSprayData {
  blockId: string;
  points: SprayPoint[];
}

export interface AudioAnalysisData {
  bass: number;
  mid: number;
  treble: number;
  volume: number;
  spectrum: Float32Array;
  beatDetected: boolean;
}

export interface AudioEffectsConfig {
  shakeIntensity: number;
  glowIntensity: number;
  collapseThreshold: number;
  enableCollapse: boolean;
  colorMode: 'frequency' | 'rainbow' | 'material' | 'pulse';
}

export interface BlueprintData {
  id: string;
  name: string;
  blocks: { position: [number, number, number]; size: [number, number, number]; material: MaterialType; rotation?: [number, number, number] }[];
  gravityDirection: GravityDirection;
  createdAt: number;
}

export interface BlockData {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  material: MaterialType;
  health: number;
  maxHealth: number;
  rotation?: [number, number, number];
  sprayCanvas?: HTMLCanvasElement | null;
  sprayTextureVersion?: number;
}

export interface ParticleData {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface ExplosionData {
  id: string;
  position: [number, number, number];
  radius: number;
  life: number;
  maxLife: number;
}

export type BuildAction =
  | { type: 'add'; block: BlockData }
  | { type: 'remove'; block: BlockData }
  | { type: 'move'; blockId: string; fromPosition: [number, number, number]; toPosition: [number, number, number] }
  | { type: 'rotate'; blockId: string; fromRotation: [number, number, number]; toRotation: [number, number, number] };

export interface RoboticArmState {
  baseAngle: number;
  shoulderAngle: number;
  elbowAngle: number;
  wristAngle: number;
  gripperOpen: boolean;
  isGrabbing: boolean;
  grabbedBlockId: string | null;
}

export interface LabObjectData {
  id: string;
  type: LabObjectType;
  position: [number, number, number];
  size?: [number, number, number];
  radius?: number;
  height?: number;
  mass: number;
  color: string;
  isStatic: boolean;
  rotation?: [number, number, number];
}

export interface LabConstraintData {
  id: string;
  type: ConstraintType;
  bodyAId: string;
  bodyBId: string;
  pivotA?: [number, number, number];
  pivotB?: [number, number, number];
  axisA?: [number, number, number];
  axisB?: [number, number, number];
  restLength?: number;
  stiffness?: number;
  damping?: number;
  maxForce?: number;
  angle?: number;
}

interface GameState {
  weapon: WeaponType;
  setWeapon: (weapon: WeaponType) => void;
  weaponCustomizations: WeaponCustomizations;
  upgradeWeapon: (weapon: WeaponType, key: WeaponUpgradeKey) => void;
  setWeaponAppearance: (weapon: WeaponType, key: WeaponAppearanceKey, value: string) => void;
  getWeaponUpgrade: (weapon: WeaponType, key: WeaponUpgradeKey) => number;
  getWeaponUpgradeMultiplier: (weapon: WeaponType, key: WeaponUpgradeKey) => number;
  getWeaponAppearance: (weapon: WeaponType) => WeaponAppearance;
  resetWeaponCustomizations: () => void;
  blocks: Map<string, BlockData>;
  addBlock: (block: BlockData) => void;
  addBlocks: (blocks: BlockData[]) => void;
  removeBlock: (id: string) => void;
  damageBlock: (id: string, damage: number) => boolean;
  updateBlockPosition: (id: string, position: [number, number, number]) => void;
  updateBlockRotation: (id: string, rotation: [number, number, number]) => void;
  sprayColor: string;
  setSprayColor: (color: string) => void;
  spraySize: number;
  setSpraySize: (size: number) => void;
  addSprayPoint: (blockId: string, point: SprayPoint) => void;
  getBlockSprayCanvas: (blockId: string) => HTMLCanvasElement | null;
  getBlockSprayPoints: (blockId: string) => SprayPoint[];
  particles: Map<string, ParticleData>;
  addParticle: (particle: ParticleData) => void;
  removeParticle: (id: string) => void;
  updateParticle: (id: string, data: Partial<ParticleData>) => void;
  explosions: Map<string, ExplosionData>;
  addExplosion: (explosion: ExplosionData) => void;
  removeExplosion: (id: string) => void;
  updateExplosion: (id: string, data: Partial<ExplosionData>) => void;
  wreckingBallActive: boolean;
  setWreckingBallActive: (active: boolean) => void;
  resetGame: () => void;
  world: CANNON.World | null;
  setWorld: (world: CANNON.World) => void;
  shootCooldown: boolean;
  setShootCooldown: (cooldown: boolean) => void;
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
  buildMaterial: MaterialType;
  setBuildMaterial: (material: MaterialType) => void;
  buildTool: BuildTool;
  setBuildTool: (tool: BuildTool) => void;
  selectedBlockId: string | null;
  setSelectedBlockId: (id: string | null) => void;
  undoStack: BuildAction[];
  redoStack: BuildAction[];
  pushUndoAction: (action: BuildAction) => void;
  undo: () => void;
  redo: () => void;
  clearBuildState: () => void;
  audioAnalysis: AudioAnalysisData;
  setAudioAnalysis: (analysis: AudioAnalysisData) => void;
  audioEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  audioEffectsConfig: AudioEffectsConfig;
  updateAudioEffectsConfig: (config: Partial<AudioEffectsConfig>) => void;
  gravityDirection: GravityDirection;
  setGravityDirection: (direction: GravityDirection) => void;
  roboticArm: RoboticArmState;
  setRoboticArmBaseAngle: (angle: number) => void;
  setRoboticArmShoulderAngle: (angle: number) => void;
  setRoboticArmElbowAngle: (angle: number) => void;
  setRoboticArmWristAngle: (angle: number) => void;
  setRoboticArmGripperOpen: (open: boolean) => void;
  setRoboticArmGrabbing: (grabbing: boolean) => void;
  setRoboticArmGrabbedBlockId: (id: string | null) => void;
  resetRoboticArm: () => void;
  labObjects: Map<string, LabObjectData>;
  labConstraints: Map<string, LabConstraintData>;
  labTool: LabTool;
  selectedLabObjectId: string | null;
  selectedConstraintType: ConstraintType;
  selectedLabObjectType: LabObjectType;
  constraintStartObjectId: string | null;
  springStiffness: number;
  springDamping: number;
  ropeLength: number;
  addLabObject: (obj: LabObjectData) => void;
  removeLabObject: (id: string) => void;
  updateLabObjectPosition: (id: string, position: [number, number, number]) => void;
  addLabConstraint: (constraint: LabConstraintData) => void;
  removeLabConstraint: (id: string) => void;
  setLabTool: (tool: LabTool) => void;
  setSelectedLabObjectId: (id: string | null) => void;
  setSelectedConstraintType: (type: ConstraintType) => void;
  setSelectedLabObjectType: (type: LabObjectType) => void;
  setConstraintStartObjectId: (id: string | null) => void;
  setSpringStiffness: (value: number) => void;
  setSpringDamping: (value: number) => void;
  setRopeLength: (value: number) => void;
  resetPhysicsLab: () => void;
  blueprints: BlueprintData[];
  saveBlueprint: (name: string) => void;
  loadBlueprint: (id: string) => void;
  deleteBlueprint: (id: string) => void;
  refreshBlueprints: () => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export const WEAPON_DEFAULTS: WeaponCustomizations = {
  wreckingBall: {
    upgrades: { damage: 1, speed: 1, radius: 1 },
    appearance: { mainColor: '#444444', trailColor: '#ff6600', glowColor: '#ff3300', effectType: 'none' },
  },
  steelBall: {
    upgrades: { damage: 1, speed: 1, radius: 1 },
    appearance: { mainColor: '#888888', trailColor: '#00ffff', glowColor: '#00ccff', effectType: 'none' },
  },
  explosive: {
    upgrades: { damage: 1, speed: 1, radius: 1 },
    appearance: { mainColor: '#ff3300', trailColor: '#ff6600', glowColor: '#ff0000', effectType: 'none' },
  },
  sprayPaint: {
    upgrades: { damage: 1, speed: 1, radius: 1 },
    appearance: { mainColor: '#ff0066', trailColor: '#ff33cc', glowColor: '#ff0099', effectType: 'none' },
  },
};

export const UPGRADE_MAX_LEVEL = 5;

export const UPGRADE_LABELS: Record<WeaponUpgradeKey, string> = {
  damage: '威力',
  speed: '速度',
  radius: '范围',
};

export const UPGRADE_MULTIPLIERS: Record<WeaponUpgradeKey, (level: number) => number> = {
  damage: (level) => 1 + (level - 1) * 0.4,
  speed: (level) => 1 + (level - 1) * 0.25,
  radius: (level) => 1 + (level - 1) * 0.3,
};

export const EFFECT_TYPE_LABELS: Record<WeaponEffectType, string> = {
  none: '无',
  fire: '烈焰',
  electric: '雷电',
  rainbow: '彩虹',
  shadow: '暗影',
};

export const EFFECT_COLORS: Record<WeaponEffectType, { main: string; trail: string; glow: string }> = {
  none: { main: '', trail: '', glow: '' },
  fire: { main: '#ff4500', trail: '#ff8c00', glow: '#ff0000' },
  electric: { main: '#00bfff', trail: '#7df9ff', glow: '#0080ff' },
  rainbow: { main: '#ff00ff', trail: '#00ffff', glow: '#ffff00' },
  shadow: { main: '#2d1b69', trail: '#6b21a8', glow: '#4c1d95' },
};

export const materialProperties: Record<MaterialType, { color: string; health: number; density: number; emissive?: string }> = {
  wood: { color: '#8B4513', health: 50, density: 600, emissive: '#2a1505' },
  glass: { color: '#88ccff', health: 20, density: 2500, emissive: '#3366aa' },
  concrete: { color: '#808080', health: 150, density: 2400, emissive: '#333333' },
};

export const MAX_UNDO_STEPS = 50;

const EMPTY_SPECTRUM = new Float32Array(1024);

const blockSprayCanvases = new Map<string, HTMLCanvasElement>();
const blockSprayPoints = new Map<string, SprayPoint[]>();
const SPRAY_CANVAS_SIZE = 256;

const BLUEPRINTS_KEY = 'destruction-blueprints';

function loadBlueprintsFromStorage(): BlueprintData[] {
  try {
    const raw = localStorage.getItem(BLUEPRINTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBlueprintsToStorage(blueprints: BlueprintData[]) {
  try {
    localStorage.setItem(BLUEPRINTS_KEY, JSON.stringify(blueprints));
  } catch {}
}

function createSprayCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SPRAY_CANVAS_SIZE;
  canvas.height = SPRAY_CANVAS_SIZE;
  return canvas;
}

function getOrCreateSprayCanvas(blockId: string): HTMLCanvasElement {
  let canvas = blockSprayCanvases.get(blockId);
  if (!canvas) {
    canvas = createSprayCanvas();
    blockSprayCanvases.set(blockId, canvas);
    blockSprayPoints.set(blockId, []);
  }
  return canvas;
}

export const useGameStore = create<GameState>((set, get) => ({
  weapon: 'wreckingBall',
  setWeapon: (weapon) => set({ weapon }),
  weaponCustomizations: JSON.parse(JSON.stringify(WEAPON_DEFAULTS)),
  upgradeWeapon: (weapon, key) =>
    set((state) => {
      const current = state.weaponCustomizations[weapon].upgrades[key];
      if (current >= UPGRADE_MAX_LEVEL) return state;
      const customizations = { ...state.weaponCustomizations };
      customizations[weapon] = {
        ...customizations[weapon],
        upgrades: { ...customizations[weapon].upgrades, [key]: current + 1 },
      };
      return { weaponCustomizations: customizations };
    }),
  setWeaponAppearance: (weapon, key, value) =>
    set((state) => {
      const customizations = { ...state.weaponCustomizations };
      customizations[weapon] = {
        ...customizations[weapon],
        appearance: { ...customizations[weapon].appearance, [key]: value },
      };
      return { weaponCustomizations: customizations };
    }),
  getWeaponUpgrade: (weapon, key) => get().weaponCustomizations[weapon].upgrades[key],
  getWeaponUpgradeMultiplier: (weapon, key) => {
    const level = get().weaponCustomizations[weapon].upgrades[key];
    return UPGRADE_MULTIPLIERS[key](level);
  },
  getWeaponAppearance: (weapon) => get().weaponCustomizations[weapon].appearance,
  resetWeaponCustomizations: () => set({ weaponCustomizations: JSON.parse(JSON.stringify(WEAPON_DEFAULTS)) }),
  blocks: new Map(),
  sprayColor: '#ff0066',
  setSprayColor: (color) => set({ sprayColor: color }),
  spraySize: 20,
  setSpraySize: (size) => set({ spraySize: Math.max(5, Math.min(80, size)) }),
  addSprayPoint: (blockId: string, point: SprayPoint) => {
    const canvas = getOrCreateSprayCanvas(blockId);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.save();
      const gradient = ctx.createRadialGradient(
        point.x * SPRAY_CANVAS_SIZE,
        point.y * SPRAY_CANVAS_SIZE,
        0,
        point.x * SPRAY_CANVAS_SIZE,
        point.y * SPRAY_CANVAS_SIZE,
        point.size
      );
      gradient.addColorStop(0, point.color);
      gradient.addColorStop(0.4, point.color + 'cc');
      gradient.addColorStop(0.7, point.color + '66');
      gradient.addColorStop(1, point.color + '00');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(
        point.x * SPRAY_CANVAS_SIZE,
        point.y * SPRAY_CANVAS_SIZE,
        point.size,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();

      const particles = 5 + Math.floor(Math.random() * 8);
      for (let i = 0; i < particles; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * point.size * 0.8;
        const px = point.x * SPRAY_CANVAS_SIZE + Math.cos(angle) * dist;
        const py = point.y * SPRAY_CANVAS_SIZE + Math.sin(angle) * dist;
        const psize = point.size * (0.1 + Math.random() * 0.3);
        ctx.fillStyle = point.color + Math.floor(80 + Math.random() * 120).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(px, py, psize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const points = blockSprayPoints.get(blockId) || [];
    points.push(point);
    blockSprayPoints.set(blockId, points);

    const blocks = new Map(get().blocks);
    const block = blocks.get(blockId);
    if (block) {
      blocks.set(blockId, {
        ...block,
        sprayTextureVersion: (block.sprayTextureVersion || 0) + 1,
      });
      set({ blocks });
    }
  },
  getBlockSprayCanvas: (blockId: string) => {
    return blockSprayCanvases.get(blockId) || null;
  },
  getBlockSprayPoints: (blockId: string) => {
    return blockSprayPoints.get(blockId) || [];
  },
  audioAnalysis: {
    bass: 0,
    mid: 0,
    treble: 0,
    volume: 0,
    spectrum: EMPTY_SPECTRUM,
    beatDetected: false,
  },
  setAudioAnalysis: (analysis) => set({ audioAnalysis: analysis }),
  audioEnabled: false,
  setAudioEnabled: (enabled) => set({ audioEnabled: enabled }),
  audioEffectsConfig: {
    shakeIntensity: 0.6,
    glowIntensity: 0.8,
    collapseThreshold: 0.75,
    enableCollapse: true,
    colorMode: 'frequency',
  },
  updateAudioEffectsConfig: (config) =>
    set((state) => ({
      audioEffectsConfig: { ...state.audioEffectsConfig, ...config },
    })),
  gravityDirection: 'down',
  setGravityDirection: (direction) => set({ gravityDirection: direction }),
  roboticArm: {
    baseAngle: 0,
    shoulderAngle: -Math.PI / 4,
    elbowAngle: Math.PI / 2,
    wristAngle: 0,
    gripperOpen: true,
    isGrabbing: false,
    grabbedBlockId: null,
  },
  setRoboticArmBaseAngle: (angle) =>
    set((state) => ({ roboticArm: { ...state.roboticArm, baseAngle: angle } })),
  setRoboticArmShoulderAngle: (angle) =>
    set((state) => ({ roboticArm: { ...state.roboticArm, shoulderAngle: angle } })),
  setRoboticArmElbowAngle: (angle) =>
    set((state) => ({ roboticArm: { ...state.roboticArm, elbowAngle: angle } })),
  setRoboticArmWristAngle: (angle) =>
    set((state) => ({ roboticArm: { ...state.roboticArm, wristAngle: angle } })),
  setRoboticArmGripperOpen: (open) =>
    set((state) => ({ roboticArm: { ...state.roboticArm, gripperOpen: open } })),
  setRoboticArmGrabbing: (grabbing) =>
    set((state) => ({ roboticArm: { ...state.roboticArm, isGrabbing: grabbing } })),
  setRoboticArmGrabbedBlockId: (id) =>
    set((state) => ({ roboticArm: { ...state.roboticArm, grabbedBlockId: id } })),
  resetRoboticArm: () =>
    set({
      roboticArm: {
        baseAngle: 0,
        shoulderAngle: -Math.PI / 4,
        elbowAngle: Math.PI / 2,
        wristAngle: 0,
        gripperOpen: true,
        isGrabbing: false,
        grabbedBlockId: null,
      },
    }),
  addBlock: (block) => {
    const blocks = new Map(get().blocks);
    blocks.set(block.id, { ...block });
    set({ blocks });
  },
  addBlocks: (newBlocks) => {
    const blocks = new Map(get().blocks);
    newBlocks.forEach((block) => {
      blocks.set(block.id, { ...block });
    });
    set({ blocks });
  },
  removeBlock: (id) => {
    const blocks = new Map(get().blocks);
    blocks.delete(id);
    blockSprayCanvases.delete(id);
    blockSprayPoints.delete(id);
    set({ blocks });
  },
  damageBlock: (id, damage) => {
    const blocks = new Map(get().blocks);
    const block = blocks.get(id);
    if (block) {
      const newHealth = block.health - damage;
      if (newHealth <= 0) {
        blocks.delete(id);
        blockSprayCanvases.delete(id);
        blockSprayPoints.delete(id);
        set({ blocks });
        return true;
      }
      blocks.set(id, { ...block, health: newHealth });
      set({ blocks });
    }
    return false;
  },
  updateBlockPosition: (id, position) => {
    const blocks = new Map(get().blocks);
    const block = blocks.get(id);
    if (block) {
      blocks.set(id, { ...block, position: [...position] as [number, number, number] });
      set({ blocks });
    }
  },
  updateBlockRotation: (id, rotation) => {
    const blocks = new Map(get().blocks);
    const block = blocks.get(id);
    if (block) {
      blocks.set(id, { ...block, rotation: [...rotation] as [number, number, number] });
      set({ blocks });
    }
  },
  particles: new Map(),
  addParticle: (particle) => {
    const particles = new Map(get().particles);
    particles.set(particle.id, { ...particle });
    set({ particles });
  },
  removeParticle: (id) => {
    const particles = new Map(get().particles);
    particles.delete(id);
    set({ particles });
  },
  updateParticle: (id, data) => {
    const particles = new Map(get().particles);
    const particle = particles.get(id);
    if (particle) {
      particles.set(id, { ...particle, ...data });
      set({ particles });
    }
  },
  explosions: new Map(),
  addExplosion: (explosion) => {
    const explosions = new Map(get().explosions);
    explosions.set(explosion.id, { ...explosion });
    set({ explosions });
  },
  removeExplosion: (id) => {
    const explosions = new Map(get().explosions);
    explosions.delete(id);
    set({ explosions });
  },
  updateExplosion: (id, data) => {
    const explosions = new Map(get().explosions);
    const explosion = explosions.get(id);
    if (explosion) {
      explosions.set(id, { ...explosion, ...data });
      set({ explosions });
    }
  },
  wreckingBallActive: false,
  setWreckingBallActive: (active) => set({ wreckingBallActive: active }),
  resetGame: () => {
    blockSprayCanvases.clear();
    blockSprayPoints.clear();
    set({
      blocks: new Map(),
      particles: new Map(),
      explosions: new Map(),
      wreckingBallActive: false,
      gravityDirection: 'down',
    });
  },
  world: null,
  setWorld: (world) => set({ world }),
  shootCooldown: false,
  setShootCooldown: (cooldown) => set({ shootCooldown: cooldown }),
  gameMode: 'destroy',
  setGameMode: (mode) => set({ gameMode: mode, selectedBlockId: null, undoStack: [], redoStack: [] }),
  buildMaterial: 'wood',
  setBuildMaterial: (material) => set({ buildMaterial: material }),
  buildTool: 'place',
  setBuildTool: (tool) => set({ buildTool: tool, selectedBlockId: tool !== 'move' && tool !== 'rotate' ? null : get().selectedBlockId }),
  selectedBlockId: null,
  setSelectedBlockId: (id) => set({ selectedBlockId: id }),
  undoStack: [],
  redoStack: [],
  pushUndoAction: (action) => {
    const currentUndo = get().undoStack;
    let newUndoStack = [...currentUndo, action];
    if (newUndoStack.length > MAX_UNDO_STEPS) {
      newUndoStack = newUndoStack.slice(newUndoStack.length - MAX_UNDO_STEPS);
    }
    set({ undoStack: newUndoStack, redoStack: [] });
  },
  undo: () => {
    const { undoStack, redoStack } = get();
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    const newRedoStack = [...redoStack, action];

    const blocks = new Map(get().blocks);

    switch (action.type) {
      case 'add': {
        blocks.delete(action.block.id);
        break;
      }
      case 'remove': {
        blocks.set(action.block.id, { ...action.block });
        break;
      }
      case 'move': {
        const block = blocks.get(action.blockId);
        if (block) {
          blocks.set(action.blockId, {
            ...block,
            position: [...action.fromPosition] as [number, number, number],
          });
        }
        break;
      }
      case 'rotate': {
        const block = blocks.get(action.blockId);
        if (block) {
          blocks.set(action.blockId, {
            ...block,
            rotation: [...action.fromRotation] as [number, number, number],
          });
        }
        break;
      }
    }

    set({ blocks, undoStack: newUndoStack, redoStack: newRedoStack, selectedBlockId: null });
  },
  redo: () => {
    const { undoStack, redoStack } = get();
    if (redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);
    let newUndoStack = [...undoStack, action];
    if (newUndoStack.length > MAX_UNDO_STEPS) {
      newUndoStack = newUndoStack.slice(newUndoStack.length - MAX_UNDO_STEPS);
    }

    const blocks = new Map(get().blocks);

    switch (action.type) {
      case 'add': {
        blocks.set(action.block.id, { ...action.block });
        break;
      }
      case 'remove': {
        blocks.delete(action.block.id);
        break;
      }
      case 'move': {
        const block = blocks.get(action.blockId);
        if (block) {
          blocks.set(action.blockId, {
            ...block,
            position: [...action.toPosition] as [number, number, number],
          });
        }
        break;
      }
      case 'rotate': {
        const block = blocks.get(action.blockId);
        if (block) {
          blocks.set(action.blockId, {
            ...block,
            rotation: [...action.toRotation] as [number, number, number],
          });
        }
        break;
      }
    }

    set({ blocks, undoStack: newUndoStack, redoStack: newRedoStack, selectedBlockId: null });
  },
  clearBuildState: () => {
    blockSprayCanvases.clear();
    blockSprayPoints.clear();
    set({
      blocks: new Map(),
      undoStack: [],
      redoStack: [],
      selectedBlockId: null,
    });
  },
  labObjects: new Map(),
  labConstraints: new Map(),
  labTool: 'placeObject',
  selectedLabObjectId: null,
  selectedConstraintType: 'spring',
  selectedLabObjectType: 'box',
  constraintStartObjectId: null,
  springStiffness: 100,
  springDamping: 10,
  ropeLength: 5,
  addLabObject: (obj) => {
    const labObjects = new Map(get().labObjects);
    labObjects.set(obj.id, { ...obj });
    set({ labObjects });
  },
  removeLabObject: (id) => {
    const labObjects = new Map(get().labObjects);
    const labConstraints = new Map(get().labConstraints);
    labObjects.delete(id);
    labConstraints.forEach((constraint, cid) => {
      if (constraint.bodyAId === id || constraint.bodyBId === id) {
        labConstraints.delete(cid);
      }
    });
    set({ labObjects, labConstraints });
  },
  updateLabObjectPosition: (id, position) => {
    const labObjects = new Map(get().labObjects);
    const obj = labObjects.get(id);
    if (obj) {
      labObjects.set(id, { ...obj, position: [...position] as [number, number, number] });
      set({ labObjects });
    }
  },
  addLabConstraint: (constraint) => {
    const labConstraints = new Map(get().labConstraints);
    labConstraints.set(constraint.id, { ...constraint });
    set({ labConstraints });
  },
  removeLabConstraint: (id) => {
    const labConstraints = new Map(get().labConstraints);
    labConstraints.delete(id);
    set({ labConstraints });
  },
  setLabTool: (tool) => set({ labTool: tool, constraintStartObjectId: null, selectedLabObjectId: null }),
  setSelectedLabObjectId: (id) => set({ selectedLabObjectId: id }),
  setSelectedConstraintType: (type) => set({ selectedConstraintType: type }),
  setSelectedLabObjectType: (type) => set({ selectedLabObjectType: type }),
  setConstraintStartObjectId: (id) => set({ constraintStartObjectId: id }),
  setSpringStiffness: (value) => set({ springStiffness: value }),
  setSpringDamping: (value) => set({ springDamping: value }),
  setRopeLength: (value) => set({ ropeLength: value }),
  resetPhysicsLab: () => {
    set({
      labObjects: new Map(),
      labConstraints: new Map(),
      selectedLabObjectId: null,
      constraintStartObjectId: null,
    });
  },
  blueprints: loadBlueprintsFromStorage(),
  saveBlueprint: (name: string) => {
    const state = get();
    const blocks = state.blocks;
    const blockEntries: BlueprintData['blocks'] = [];
    blocks.forEach((block) => {
      blockEntries.push({
        position: [...block.position] as [number, number, number],
        size: [...block.size] as [number, number, number],
        material: block.material,
        rotation: block.rotation ? [...block.rotation] as [number, number, number] : undefined,
      });
    });

    if (blockEntries.length === 0) return;

    const blueprint: BlueprintData = {
      id: generateId(),
      name,
      blocks: blockEntries,
      gravityDirection: state.gravityDirection,
      createdAt: Date.now(),
    };

    const blueprints = [...get().blueprints, blueprint];
    saveBlueprintsToStorage(blueprints);
    set({ blueprints });
  },
  loadBlueprint: (id: string) => {
    const blueprint = get().blueprints.find((b) => b.id === id);
    if (!blueprint) return;

    blockSprayCanvases.clear();
    blockSprayPoints.clear();

    const newBlocks = new Map<string, BlockData>();
    blueprint.blocks.forEach((entry) => {
      const blockId = generateId();
      const props = materialProperties[entry.material];
      newBlocks.set(blockId, {
        id: blockId,
        position: [...entry.position] as [number, number, number],
        size: [...entry.size] as [number, number, number],
        material: entry.material,
        health: props.health,
        maxHealth: props.health,
        rotation: entry.rotation ? [...entry.rotation] as [number, number, number] : [0, 0, 0],
      });
    });

    set({
      blocks: newBlocks,
      gravityDirection: blueprint.gravityDirection,
      undoStack: [],
      redoStack: [],
      selectedBlockId: null,
    });
  },
  deleteBlueprint: (id: string) => {
    const blueprints = get().blueprints.filter((b) => b.id !== id);
    saveBlueprintsToStorage(blueprints);
    set({ blueprints });
  },
  refreshBlueprints: () => {
    set({ blueprints: loadBlueprintsFromStorage() });
  },
}));

export { generateId };
