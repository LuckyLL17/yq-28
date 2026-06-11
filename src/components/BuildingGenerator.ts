import { BlockData, MaterialType, materialProperties, generateId } from '@/store/gameStore';

interface BuildingConfig {
  width: number;
  height: number;
  depth: number;
  blockSize?: [number, number, number];
}

const createBlock = (
  x: number,
  y: number,
  z: number,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  material: MaterialType
): BlockData => {
  const properties = materialProperties[material];
  return {
    id: generateId(),
    position: [x, y, z],
    size: [sizeX, sizeY, sizeZ],
    material,
    health: properties.health,
    maxHealth: properties.health,
  };
};

export function generateBuilding(config: BuildingConfig): BlockData[] {
  const blocks: BlockData[] = [];
  const { width, height, depth } = config;
  const [blockW, blockH, blockD] = config.blockSize || [1, 0.5, 1];
  const layerHeight = blockH * 2;

  for (let floor = 0; floor < height; floor++) {
    const y = floor * layerHeight + blockH / 2;

    const isTopFloor = floor === height - 1;
    const isBottomFloor = floor === 0;

    for (let w = 0; w < width; w++) {
      for (let d = 0; d < depth; d++) {
        const isWall = w === 0 || w === width - 1 || d === 0 || d === depth - 1;
        const isCorner = (w === 0 || w === width - 1) && (d === 0 || d === depth - 1);

        const x = (w - width / 2) * blockW + blockW / 2;
        const z = (d - depth / 2) * blockD + blockD / 2;

        if (isWall) {
          let material: MaterialType = 'concrete';

          if (isCorner) {
            material = 'concrete';
          } else if (isTopFloor) {
            material = Math.random() > 0.3 ? 'glass' : 'wood';
          } else if (isBottomFloor) {
            material = 'concrete';
          } else {
            const windowPattern = (w + d + floor) % 3;
            if (windowPattern === 0) {
              material = 'glass';
            } else if (windowPattern === 1) {
              material = 'wood';
            } else {
              material = 'concrete';
            }
          }

          blocks.push(createBlock(x, y, z, blockW * 0.95, blockH * 1.9, blockD * 0.95, material));
        }
      }
    }

    if (floor > 0) {
      const floorY = (floor - 0.5) * layerHeight + blockH;
      for (let w = 0; w < width; w++) {
        for (let d = 0; d < depth; d++) {
          const x = (w - width / 2) * blockW + blockW / 2;
          const z = (d - depth / 2) * blockD + blockD / 2;

          const isEdgeBeam = w === 0 || w === width - 1 || d === 0 || d === depth - 1;
          const isColumnLine = w % 3 === 0 || d % 3 === 0;

          if (isEdgeBeam || isColumnLine) {
            blocks.push(createBlock(x, floorY, z, blockW * 0.8, blockH * 0.4, blockD * 0.8, 'concrete'));
          } else {
            blocks.push(createBlock(x, floorY, z, blockW * 0.9, blockH * 0.2, blockD * 0.9, 'wood'));
          }
        }
      }
    }

    for (let cw = 0; cw < width; cw += 3) {
      for (let cd = 0; cd < depth; cd += 3) {
        const cx = (cw - width / 2) * blockW + blockW / 2;
        const cz = (cd - depth / 2) * blockD + blockD / 2;
        for (let subFloor = 0; subFloor < 2; subFloor++) {
          const cy = y + subFloor * blockH;
          blocks.push(createBlock(cx, cy, cz, blockW * 0.7, blockH * 0.9, blockD * 0.7, 'concrete'));
        }
      }
    }
  }

  const roofY = height * layerHeight + blockH / 2;
  for (let w = 0; w < width; w++) {
    for (let d = 0; d < depth; d++) {
      const x = (w - width / 2) * blockW + blockW / 2;
      const z = (d - depth / 2) * blockD + blockD / 2;
      blocks.push(createBlock(x, roofY, z, blockW * 0.9, blockH * 0.3, blockD * 0.9, 'wood'));
    }
  }

  return blocks;
}

export function generateCastle(config: BuildingConfig): BlockData[] {
  const blocks: BlockData[] = [];
  const { width, height, depth } = config;
  const [blockW, blockH, blockD] = config.blockSize || [0.8, 0.4, 0.8];
  const layerHeight = blockH * 2;

  const towers = [
    [0, 0],
    [width - 1, 0],
    [0, depth - 1],
    [width - 1, depth - 1],
  ];

  for (const [tw, td] of towers) {
    for (let floor = 0; floor < height + 2; floor++) {
      for (let subY = 0; subY < 2; subY++) {
        const y = floor * layerHeight + subY * blockH + blockH / 2;
        const x = (tw - width / 2) * blockW + blockW / 2;
        const z = (td - depth / 2) * blockD + blockD / 2;

        blocks.push(createBlock(x, y, z, blockW * 0.95, blockH * 0.95, blockD * 0.95, 'concrete'));

        if (subY === 0) {
          blocks.push(createBlock(x + blockW * 0.5, y, z, blockW * 0.3, blockH * 0.95, blockD * 0.3, 'concrete'));
          blocks.push(createBlock(x - blockW * 0.5, y, z, blockW * 0.3, blockH * 0.95, blockD * 0.3, 'concrete'));
          blocks.push(createBlock(x, y, z + blockD * 0.5, blockW * 0.3, blockH * 0.95, blockD * 0.3, 'concrete'));
          blocks.push(createBlock(x, y, z - blockD * 0.5, blockW * 0.3, blockH * 0.95, blockD * 0.3, 'concrete'));
        }
      }
    }
  }

  for (let floor = 0; floor < height; floor++) {
    for (let subY = 0; subY < 2; subY++) {
      const y = floor * layerHeight + subY * blockH + blockH / 2;

      for (let w = 1; w < width - 1; w++) {
        const x = (w - width / 2) * blockW + blockW / 2;
        const z1 = (0 - depth / 2) * blockD + blockD / 2;
        const z2 = (depth - 1 - depth / 2) * blockD + blockD / 2;

        const hasWindow = subY === 1 && w % 2 === 0 && floor > 0;
        if (hasWindow) {
          blocks.push(createBlock(x, y, z1, blockW * 0.8, blockH * 0.9, blockD * 0.2, 'glass'));
          blocks.push(createBlock(x, y, z2, blockW * 0.8, blockH * 0.9, blockD * 0.2, 'glass'));
        } else {
          blocks.push(createBlock(x, y, z1, blockW * 0.95, blockH * 0.95, blockD * 0.5, 'concrete'));
          blocks.push(createBlock(x, y, z2, blockW * 0.95, blockH * 0.95, blockD * 0.5, 'concrete'));
        }
      }

      for (let d = 1; d < depth - 1; d++) {
        const z = (d - depth / 2) * blockD + blockD / 2;
        const x1 = (0 - width / 2) * blockW + blockW / 2;
        const x2 = (width - 1 - width / 2) * blockW + blockW / 2;

        const hasWindow = subY === 1 && d % 2 === 0 && floor > 0;
        if (hasWindow) {
          blocks.push(createBlock(x1, y, z, blockW * 0.2, blockH * 0.9, blockD * 0.8, 'glass'));
          blocks.push(createBlock(x2, y, z, blockW * 0.2, blockH * 0.9, blockD * 0.8, 'glass'));
        } else {
          blocks.push(createBlock(x1, y, z, blockW * 0.5, blockH * 0.95, blockD * 0.95, 'concrete'));
          blocks.push(createBlock(x2, y, z, blockW * 0.5, blockH * 0.95, blockD * 0.95, 'concrete'));
        }
      }
    }

    if (floor > 0) {
      const floorY = (floor - 0.5) * layerHeight + blockH;
      for (let w = 1; w < width - 1; w++) {
        for (let d = 1; d < depth - 1; d++) {
          const x = (w - width / 2) * blockW + blockW / 2;
          const z = (d - depth / 2) * blockD + blockD / 2;
          blocks.push(createBlock(x, floorY, z, blockW * 0.85, blockH * 0.2, blockD * 0.85, 'wood'));
        }
      }
    }
  }

  return blocks;
}

export default generateBuilding;
