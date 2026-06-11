import { create } from 'zustand';
import * as CANNON from 'cannon-es';

export type WeaponType = 'wreckingBall' | 'steelBall' | 'explosive';
export type MaterialType = 'wood' | 'glass' | 'concrete';

export interface BlockData {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  material: MaterialType;
  health: number;
  maxHealth: number;
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

interface GameState {
  weapon: WeaponType;
  setWeapon: (weapon: WeaponType) => void;
  blocks: Map<string, BlockData>;
  addBlock: (block: BlockData) => void;
  addBlocks: (blocks: BlockData[]) => void;
  removeBlock: (id: string) => void;
  damageBlock: (id: string, damage: number) => boolean;
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
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export const materialProperties: Record<MaterialType, { color: string; health: number; density: number; emissive?: string }> = {
  wood: { color: '#8B4513', health: 50, density: 600, emissive: '#2a1505' },
  glass: { color: '#88ccff', health: 20, density: 2500, emissive: '#3366aa' },
  concrete: { color: '#808080', health: 150, density: 2400, emissive: '#333333' },
};

export const useGameStore = create<GameState>((set, get) => ({
  weapon: 'wreckingBall',
  setWeapon: (weapon) => set({ weapon }),
  blocks: new Map(),
  addBlock: (block) => {
    const blocks = new Map(get().blocks);
    blocks.set(block.id, block);
    set({ blocks });
  },
  addBlocks: (newBlocks) => {
    const blocks = new Map(get().blocks);
    newBlocks.forEach((block) => {
      blocks.set(block.id, block);
    });
    set({ blocks });
  },
  removeBlock: (id) => {
    const blocks = new Map(get().blocks);
    blocks.delete(id);
    set({ blocks });
  },
  damageBlock: (id, damage) => {
    const blocks = new Map(get().blocks);
    const block = blocks.get(id);
    if (block) {
      block.health -= damage;
      if (block.health <= 0) {
        blocks.delete(id);
        set({ blocks });
        return true;
      }
      set({ blocks });
    }
    return false;
  },
  particles: new Map(),
  addParticle: (particle) => {
    const particles = new Map(get().particles);
    particles.set(particle.id, particle);
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
      Object.assign(particle, data);
      set({ particles });
    }
  },
  explosions: new Map(),
  addExplosion: (explosion) => {
    const explosions = new Map(get().explosions);
    explosions.set(explosion.id, explosion);
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
      Object.assign(explosion, data);
      set({ explosions });
    }
  },
  wreckingBallActive: false,
  setWreckingBallActive: (active) => set({ wreckingBallActive: active }),
  resetGame: () => set({
    blocks: new Map(),
    particles: new Map(),
    explosions: new Map(),
    wreckingBallActive: false,
  }),
  world: null,
  setWorld: (world) => set({ world }),
  shootCooldown: false,
  setShootCooldown: (cooldown) => set({ shootCooldown: cooldown }),
}));

export { generateId };
