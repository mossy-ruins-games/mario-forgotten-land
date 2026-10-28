export type MatName =
  | 'grass'
  | 'road'
  | 'sand'
  | 'stone'
  | 'tile'
  | 'wood'
  | 'brick'
  | 'plaster'
  | 'dirt'
  | 'concrete'
  | 'metal';

export interface Solid {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  mat: MatName;
}

export interface CoinDef {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface Decor {
  t: 'building' | 'tree' | 'palm' | 'rock' | 'car' | 'vine' | 'crack' | 'slab' | 'pillar' | 'cloud' | 'sign' | 'umbrella' | 'bush' | 'fountain' | 'beam';
  x?: number;
  y?: number;
  z?: number;
  w?: number;
  h?: number;
  d?: number;
  s?: number;
  rot?: number;
  color?: number;
  text?: string;
}

export interface LevelDef {
  id: string;
  name: string;
  sky: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  camYaw: number;
  camDist: number;
  camHeight: number;
  start: [number, number, number];
  killY: number;
  solids: Solid[];
  coins: CoinDef[];
  enemies: { kind: 'goomba' | 'koopa'; x: number; z: number; axis: 'x' | 'z'; min: number; max: number }[];
  toads: { id: string; x: number; y: number; z: number; tint: number }[];
  pickups: { kind: 'mushroom' | 'flower' | 'star'; x: number; y: number; z: number }[];
  cones: { id: string; x: number; y: number; z: number }[];
  cars: { id: string; x: number; y: number; z: number; rot: number }[];
  breakables: { id: string; x: number; z: number; w: number; h: number; d: number; base: number }[];
  checkpoints: { id: string; x: number; y: number; z: number }[];
  pads: { x: number; y: number; z: number; power: number }[];
  goal: [number, number, number] | null;
  portals: { id: string; x: number; z: number; w: number; d: number; need: number; label: string }[];
  boss: boolean;
  decors: Decor[];
  water: { y: number; x: number; z: number; w: number; d: number } | null;
  pit: { y: number; x: number; z: number; w: number; d: number } | null;
}

function slab(x: number, top: number, z: number, w: number, d: number, mat: MatName, thick = 1.7): Solid {
  return {
    minX: x - w / 2,
    maxX: x + w / 2,
    minY: top - thick,
    maxY: top,
    minZ: z - d / 2,
    maxZ: z + d / 2,
    mat,
  };
}

function wall(x: number, base: number, z: number, w: number, h: number, d: number, mat: MatName): Solid {
  return {
    minX: x - w / 2,
    maxX: x + w / 2,
    minY: base,
    maxY: base + h,
    minZ: z - d / 2,
    maxZ: z + d / 2,
    mat,
  };
}

function coinsOf(level: string): { at: (x: number, y: number, z: number) => void; line: (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, n: number) => void; list: CoinDef[] } {
  const list: CoinDef[] = [];
  let n = 0;
  return {
    list,
    at(x, y, z) {
      list.push({ id: `${level}:coin:${n++}`, x, y, z });
    },
    line(x1, y1, z1, x2, y2, z2, count) {
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0.5 : i / (count - 1);
        list.push({
          id: `${level}:coin:${n++}`,
          x: x1 + (x2 - x1) * t,
          y: y1 + (y2 - y1) * t,
          z: z1 + (z2 - z1) * t,
        });
      }
    },
  };
}

function hub(): LevelDef {
  const solids: Solid[] = [slab(0, 0, 0, 54, 54, 'grass')];
  const far = 27;
  const gap = 2.7;
  const edge = 23.6;
  const span = far - gap;
  const mid = (far + gap) / 2;
  const t = 1.5;
  const h = 3.3;
  solids.push(wall(-mid, 0, -edge, span, h, t, 'stone'));
  solids.push(wall(mid, 0, -edge, span, h, t, 'stone'));
  solids.push(wall(-mid, 0, edge, span, h, t, 'stone'));
  solids.push(wall(mid, 0, edge, span, h, t, 'stone'));
  solids.push(wall(-edge, 0, -mid, t, h, span, 'stone'));
  solids.push(wall(-edge, 0, mid, t, h, span, 'stone'));
  solids.push(wall(edge, 0, -mid, t, h, span, 'stone'));
  solids.push(wall(edge, 0, mid, t, h, span, 'stone'));
  solids.push(wall(0, 0, -1.6, 2.4, 0.95, 2.4, 'stone'));

  return {
    id: 'hub',
    name: 'Forgotten Plaza',
    sky: 0x87c4ea,
    fog: 0xc5dcc8,
    fogNear: 24,
    fogFar: 78,
    camYaw: 0.55,
    camDist: 11,
    camHeight: 7.2,
    start: [0, 0, 8],
    killY: -8,
    solids,
    coins: [],
    enemies: [],
    toads: [],
    pickups: [],
    cones: [],
    cars: [],
    breakables: [],
    checkpoints: [],
    pads: [],
    goal: null,
    boss: false,
    water: null,
    pit: null,
    portals: [
      { id: 'highway', x: 0, z: -23.6, w: 4.6, d: 3.4, need: 0, label: 'Highway' },
      { id: 'mall', x: 23.6, z: 0, w: 3.4, d: 4.6, need: 0, label: 'Mall' },
      { id: 'beach', x: -23.6, z: 0, w: 3.4, d: 4.6, need: 0, label: 'Beach' },
      { id: 'boss', x: 0, z: 23.6, w: 4.6, d: 3.4, need: 3, label: 'Turtle King' },
    ],
    decors: [
      { t: 'fountain' },
      { t: 'slab', x: 0, y: 0.04, z: -12, w: 4.2, h: 0.06, d: 18, color: 0xb7b8b4 },
      { t: 'slab', x: 12, y: 0.04, z: 0, w: 18, h: 0.06, d: 4.2, color: 0xb7b8b4 },
      { t: 'slab', x: -12, y: 0.04, z: 0, w: 18, h: 0.06, d: 4.2, color: 0xb7b8b4 },
      { t: 'slab', x: 0, y: 0.04, z: 12, w: 4.2, h: 0.06, d: 16, color: 0xb7b8b4 },
      { t: 'sign', x: 0, y: 3.4, z: -23, text: 'Highway' },
      { t: 'sign', x: 23, y: 3.4, z: 0, text: 'Mall' },
      { t: 'sign', x: -23, y: 3.4, z: 0, text: 'Beach' },
      { t: 'sign', x: 0, y: 3.6, z: 23, text: '3 friends' },
      { t: 'sign', x: 2.4, y: 2.2, z: 4.2, text: 'Our friends!' },
      { t: 'tree', x: -15, z: -15, s: 1.2 },
      { t: 'tree', x: 15, z: -14, s: 1.35 },
      { t: 'tree', x: -16, z: 14, s: 1.1 },
      { t: 'tree', x: 16, z: 15, s: 1.25 },
      { t: 'tree', x: -8, z: 16, s: 0.9 },
      { t: 'bush', x: 6, z: 6, s: 1 },
      { t: 'bush', x: -6, z: -8, s: 0.8 },
      { t: 'pillar', x: -4, z: -21, h: 3.6 },
      { t: 'pillar', x: 4, z: -21, h: 3.6 },
      { t: 'pillar', x: -4, z: 21, h: 3.6 },
      { t: 'pillar', x: 4, z: 21, h: 3.6 },
      { t: 'pillar', x: 21, z: -4, h: 3.6 },
      { t: 'pillar', x: 21, z: 4, h: 3.6 },
      { t: 'pillar', x: -21, z: -4, h: 3.6 },
      { t: 'pillar', x: -21, z: 4, h: 3.6 },
      { t: 'building', x: -34, z: -8, w: 10, h: 12, d: 8, color: 0xcbbba8 },
      { t: 'building', x: 34, z: 6, w: 12, h: 16, d: 9, color: 0xb7c0b4 },
      { t: 'building', x: 8, z: -36, w: 14, h: 10, d: 8, color: 0xd5c8b4 },
      { t: 'building', x: -10, z: 36, w: 16, h: 14, d: 8, color: 0xc3b6a6 },
      { t: 'cloud', x: -10, y: 16, z: -6 },
      { t: 'cloud', x: 14, y: 18, z: 8 },
      { t: 'vine', x: -29, y: 6, z: -8, h: 5 },
      { t: 'vine', x: 28, y: 7, z: 6, h: 6 },
    ],
  };
}

function highway(): LevelDef {
  const solids: Solid[] = [];
  solids.push(slab(0, 0, 9, 16, 16, 'grass'));
  solids.push(slab(0, 0, -10, 8, 24, 'road'));
  solids.push(slab(0, 0, -29.6, 8, 8, 'road'));
  let z = -33.6;
  let top = 0;
  for (let i = 0; i < 6; i++) {
    top += 0.42;
    const zc = z - 0.6;
    solids.push(slab(0, top, zc, 8, 1.25, 'stone'));
    z -= 1.2;
  }
  const highTop = top;
  const highStart = z;
  solids.push(slab(0, highTop, highStart - 9, 8, 18, 'road'));
  z = highStart - 18;
  for (let i = 0; i < 6; i++) {
    top -= 0.42;
    const zc = z - 0.6;
    solids.push(slab(0, top, zc, 8, 1.25, 'stone'));
    z -= 1.2;
  }
  solids.push(slab(0, 0, z - 11, 10, 22, 'road'));
  const endZ = z - 22;
  solids.push(slab(0, 0, endZ - 6, 12, 12, 'grass'));
  solids.push(slab(6.5, highTop, -50, 5.2, 4.6, 'stone'));
  solids.push(slab(-6.6, 2.3, -14, 3.2, 3.2, 'stone'));
  solids.push(slab(11.2, 0, -29.5, 3.2, 3.2, 'stone'));

  const bag = coinsOf('highway');
  bag.line(-2, 1.2, 6, 2, 1.2, -2, 5);
  bag.line(0, 1.3, -18, 0, 2.2, -24, 4);
  bag.line(0, 1.2, -26, 0, 1.6, -32, 4);
  bag.line(4.2, 1.3, -29.5, 9.2, 1.5, -29.5, 4);
  bag.line(-1, highTop + 1.2, -44, 1, highTop + 1.2, -56, 6);
  bag.at(-6.6, 3.6, -14);
  bag.at(-6.6, 4.1, -14);
  bag.line(0, 1.2, -70, 0, 1.2, -90, 8);
  bag.at(8.2, highTop + 1.3, -50);
  bag.at(8.2, highTop + 1.8, -50);

  const goalZ = endZ - 8;
  return {
    id: 'highway',
    name: 'Cracked Highway',
    sky: 0x8ec8ee,
    fog: 0xb7d4c8,
    fogNear: 26,
    fogFar: 80,
    camYaw: 0.42,
    camDist: 9.5,
    camHeight: 5.4,
    start: [0, 0, 12],
    killY: -1.35,
    solids,
    coins: bag.list,
    enemies: [
      { kind: 'goomba', x: 0, z: -14, axis: 'z', min: -20, max: -10 },
      { kind: 'goomba', x: 0, z: -29.6, axis: 'x', min: -2.4, max: 2.4 },
      { kind: 'koopa', x: 0.6, z: -50, axis: 'z', min: -56, max: -44 },
      { kind: 'goomba', x: -1, z: -78, axis: 'z', min: -86, max: -70 },
    ],
    toads: [
      { id: 'highway-1', x: 0, y: 0, z: -6, tint: 0xe23b32 },
      { id: 'highway-2', x: 0, y: 0, z: -86, tint: 0x3a7bd5 },
      { id: 'highway-3', x: 8, y: highTop, z: -50, tint: 0xf2c14b },
    ],
    pickups: [
      { kind: 'mushroom', x: -4, y: 0, z: 8 },
      { kind: 'flower', x: -2, y: highTop, z: -46 },
      { kind: 'star', x: 11.2, y: 0, z: -29.5 },
    ],
    cones: [{ id: 'hw-cone', x: 2.2, y: highTop, z: -47.5 }],
    cars: [{ id: 'hw-car', x: 0, y: 0, z: -16, rot: Math.PI }],
    breakables: [{ id: 'hw-bricks', x: 4.35, z: -50, w: 1.5, h: 2.4, d: 5.6, base: highTop }],
    checkpoints: [{ id: 'hw-bell', x: 0, y: highTop, z: -48 }],
    pads: [{ x: -2.3, y: 0, z: -14, power: 14 }],
    goal: [0, 0, goalZ],
    portals: [],
    boss: false,
    water: null,
    pit: { y: -2.4, x: 0, z: -40, w: 40, d: 140 },
    decors: [
      { t: 'sign', x: -3.2, y: 2, z: 4, text: 'Jump!' },
      { t: 'sign', x: 2.4, y: 2, z: -26, text: 'Jump again!' },
      { t: 'sign', x: 2.2, y: highTop + 2, z: -45.5, text: 'Smash!' },
      { t: 'sign', x: -2.4, y: 2, z: -14.8, text: 'Bounce!' },
      { t: 'crack', x: 0.4, y: 0.05, z: -8, w: 3.2, h: 0.05, d: 0.35 },
      { t: 'crack', x: -0.6, y: 0.05, z: -14, w: 2.4, h: 0.05, d: 0.3 },
      { t: 'crack', x: 0.2, y: highTop + 0.05, z: -52, w: 2.8, h: 0.05, d: 0.3 },
      { t: 'building', x: -16, z: 4, w: 8, h: 11, d: 8, color: 0xd2c6b4 },
      { t: 'building', x: 16, z: -6, w: 9, h: 14, d: 8, color: 0xc3b7a6 },
      { t: 'building', x: -18, z: -28, w: 8, h: 9, d: 10, color: 0xb7c2bc },
      { t: 'building', x: 18, z: -48, w: 10, h: 16, d: 8, color: 0xd8cbb8 },
      { t: 'building', x: -17, z: -70, w: 8, h: 12, d: 8, color: 0xcbbdaa },
      { t: 'car', x: -6.5, z: -4, rot: 0.4, color: 0x8d4a32 },
      { t: 'car', x: 7, z: -36, rot: 1.2, color: 0x6e7278 },
      { t: 'tree', x: -10, z: 12, s: 1.1 },
      { t: 'tree', x: 10, z: 10, s: 1.3 },
      { t: 'tree', x: -12, z: -40, s: 1 },
      { t: 'vine', x: 12.2, y: 6, z: -6, h: 5 },
      { t: 'vine', x: -14, y: 5, z: -28, h: 4 },
      { t: 'cloud', x: -6, y: 14, z: 0 },
      { t: 'cloud', x: 8, y: 16, z: -30 },
      { t: 'bush', x: 6, z: 8, s: 0.8 },
    ],
  };
}

function mall(): LevelDef {
  const solids: Solid[] = [];
  solids.push(slab(0, 0, -18, 18, 54, 'tile'));
  let z = -8.2;
  let top = 0;
  for (let i = 0; i < 8; i++) {
    top += 0.4;
    const zc = z - 0.36;
    solids.push(slab(-6.5, top, zc, 5.1, 0.78, 'stone'));
    z -= 0.72;
  }
  solids.push(slab(-6.5, 3.2, -24, 5.2, 18, 'tile'));
  solids.push(wall(5.6, 0, -12, 3.4, 1, 3.2, 'wood'));
  solids.push(wall(5.4, 0, -28, 3.2, 1, 4.4, 'wood'));
  solids.push(wall(0, 0, -6, 2.2, 0.8, 1.2, 'wood'));

  const bag = coinsOf('mall');
  bag.line(-1, 1.2, 2, 1, 1.2, -6, 5);
  bag.line(-6.5, 4.4, -16, -6.5, 4.4, -30, 6);
  bag.line(0, 1.2, -16, 0, 1.6, -22, 4);
  bag.line(2, 1.2, -34, 2, 1.2, -40, 4);
  bag.at(-8.2, 1.3, -36);
  bag.at(-8.2, 1.8, -36);
  bag.at(-8.2, 2.3, -36);
  bag.at(5, 2.4, -20);
  bag.at(5, 2.9, -20);

  return {
    id: 'mall',
    name: 'Leafy Mall',
    sky: 0xc9d8c4,
    fog: 0xd7e3d2,
    fogNear: 16,
    fogFar: 58,
    camYaw: 0.62,
    camDist: 8.2,
    camHeight: 11.5,
    start: [0, 0, 4],
    killY: -4,
    solids,
    coins: bag.list,
    enemies: [
      { kind: 'goomba', x: 1, z: -10, axis: 'z', min: -16, max: -2 },
      { kind: 'koopa', x: 0, z: -22, axis: 'x', min: -2, max: 3.5 },
      { kind: 'goomba', x: 1.5, z: -36, axis: 'z', min: -40, max: -30 },
      { kind: 'koopa', x: -6.5, z: -22, axis: 'x', min: -8.2, max: -4.8 },
    ],
    toads: [
      { id: 'mall-1', x: 0, y: 0, z: -8, tint: 0xe23b32 },
      { id: 'mall-2', x: 0.5, y: 0, z: -40, tint: 0x3aaa3a },
      { id: 'mall-3', x: 8.15, y: 0, z: -28, tint: 0x7a4ec8 },
    ],
    pickups: [
      { kind: 'mushroom', x: -6.5, y: 3.2, z: -18 },
      { kind: 'flower', x: 7.6, y: 0, z: -12 },
      { kind: 'star', x: 5, y: 0, z: -20 },
    ],
    cones: [{ id: 'mall-cone', x: -3.4, y: 0, z: -36 }],
    cars: [{ id: 'mall-car', x: 2.2, y: 0, z: 2.5, rot: Math.PI }],
    breakables: [{ id: 'mall-bricks', x: -6.3, z: -36, w: 0.9, h: 2.2, d: 3.4, base: 0 }],
    checkpoints: [{ id: 'mall-bell', x: 0, y: 0, z: -20 }],
    pads: [],
    goal: [0, 0, -43],
    portals: [],
    boss: false,
    water: null,
    pit: null,
    decors: [
      { t: 'sign', x: -6.5, y: 2.2, z: -6, text: 'Up!' },
      { t: 'sign', x: -3.2, y: 2, z: -33, text: 'Smash!' },
      { t: 'sign', x: 6, y: 2.1, z: -24, text: 'Shop' },
      { t: 'pillar', x: -2.2, z: -4, h: 5.5, s: 0.35 },
      { t: 'pillar', x: 3.5, z: -4, h: 5.5, s: 0.35 },
      { t: 'pillar', x: -2.2, z: -30, h: 5.5, s: 0.35 },
      { t: 'pillar', x: 3.8, z: -30, h: 5.5, s: 0.35 },
      { t: 'beam', x: 0, y: 6.2, z: -18, w: 16, h: 0.35, d: 0.5 },
      { t: 'beam', x: 0, y: 6.2, z: -32, w: 16, h: 0.35, d: 0.5 },
      { t: 'vine', x: -8.6, y: 3.5, z: -14, h: 3.2 },
      { t: 'vine', x: 8.6, y: 3.2, z: -18, h: 3 },
      { t: 'vine', x: 8.4, y: 3.4, z: -34, h: 3.4 },
      { t: 'bush', x: -4, z: 2, s: 0.7 },
      { t: 'bush', x: 5, z: -16, s: 0.6 },
      { t: 'building', x: -20, z: -18, w: 8, h: 10, d: 20, color: 0xd5cfc4 },
      { t: 'building', x: 20, z: -18, w: 8, h: 11, d: 22, color: 0xc9c3b6 },
      { t: 'cloud', x: 0, y: 14, z: -10 },
    ],
  };
}

function beach(): LevelDef {
  const solids: Solid[] = [];
  solids.push(slab(0, 0, 8, 22, 18, 'sand'));
  solids.push(slab(0, 0, -10.2, 16, 12, 'sand'));
  solids.push(slab(-2, 0, -21, 3.3, 3.3, 'wood'));
  solids.push(slab(2.4, 0, -27.6, 3.3, 3.3, 'wood'));
  solids.push(slab(-1, 0, -34.2, 3.3, 3.3, 'wood'));
  solids.push(slab(-6.2, 0, -30, 3.6, 3.6, 'sand'));
  solids.push(slab(0, 0, -46.5, 22, 18, 'sand'));
  solids.push(slab(0, 0.35, -66, 5, 24, 'wood'));
  solids.push(wall(10.2, 0, -44, 3.2, 1.7, 3.2, 'stone'));
  solids.push(wall(11.4, 0, -49, 3.4, 2.1, 3.2, 'stone'));
  solids.push(wall(8.2, 0, -51.2, 2.6, 1.5, 2.4, 'stone'));

  const bag = coinsOf('beach');
  bag.line(-2, 1.2, 12, 2, 1.2, 2, 5);
  bag.line(0, 1.4, -2, 0, 1.6, -8, 4);
  bag.line(-2, 1.3, -18, 2.4, 1.5, -26, 4);
  bag.line(2.4, 1.4, -27.6, -1, 1.5, -34, 3);
  bag.line(-4, 1.3, -28, -6.2, 1.5, -30, 3);
  bag.line(0, 1.2, -42, 0, 1.5, -58, 6);
  bag.line(0, 1.6, -60, 0, 1.6, -70, 4);
  bag.at(8.4, 1.4, -47);

  return {
    id: 'beach',
    name: 'Sunny Beach',
    sky: 0x79c8f2,
    fog: 0xc6e4f5,
    fogNear: 22,
    fogFar: 84,
    camYaw: 0.28,
    camDist: 10,
    camHeight: 6.2,
    start: [0, 0, 12],
    killY: -0.85,
    solids,
    coins: bag.list,
    enemies: [
      { kind: 'koopa', x: 0, z: -7, axis: 'x', min: -4, max: 4 },
      { kind: 'goomba', x: 2, z: -44, axis: 'x', min: -4, max: 5 },
      { kind: 'goomba', x: -2, z: -50, axis: 'z', min: -54, max: -42 },
    ],
    toads: [
      { id: 'beach-1', x: 0, y: 0, z: -13, tint: 0xf08a24 },
      { id: 'beach-2', x: 8.6, y: 0, z: -47.2, tint: 0x2aa7a0 },
      { id: 'beach-3', x: 0, y: 0.35, z: -69, tint: 0xf2a3b5 },
    ],
    pickups: [
      { kind: 'mushroom', x: -5, y: 0, z: 10 },
      { kind: 'flower', x: 0, y: 0.35, z: -60 },
      { kind: 'star', x: -6.2, y: 0, z: -30 },
    ],
    cones: [{ id: 'beach-cone', x: 4.5, y: 0, z: 6 }],
    cars: [{ id: 'beach-car', x: -3, y: 0, z: 5, rot: Math.PI }],
    breakables: [{ id: 'beach-rock', x: 7.2, z: 3, w: 2.2, h: 1.6, d: 2.2, base: 0 }],
    checkpoints: [
      { id: 'beach-bell-1', x: 0, y: 0, z: -9 },
      { id: 'beach-bell-2', x: 0, y: 0, z: -44 },
    ],
    pads: [],
    goal: [0, 0.35, -74],
    portals: [],
    boss: false,
    water: { y: -0.45, x: 0, z: -30, w: 80, d: 120 },
    pit: null,
    decors: [
      { t: 'sign', x: -4, y: 2, z: 8, text: 'Jump!' },
      { t: 'sign', x: 5, y: 2, z: -42, text: 'A friend?' },
      { t: 'palm', x: -8, z: 10, s: 1.2 },
      { t: 'palm', x: 8, z: 12, s: 1.35 },
      { t: 'palm', x: -9, z: -12, s: 1.1 },
      { t: 'palm', x: 8, z: -40, s: 1.25 },
      { t: 'palm', x: -8, z: -52, s: 1 },
      { t: 'umbrella', x: 6, z: 8, color: 0xe23b32 },
      { t: 'umbrella', x: -6, z: -44, color: 0x3a7bd5 },
      { t: 'rock', x: -8, y: 0.4, z: 4, s: 0.6 },
      { t: 'rock', x: 9, y: 0.5, z: -8, s: 0.8 },
      { t: 'cloud', x: -12, y: 14, z: 0 },
      { t: 'cloud', x: 10, y: 15, z: -20 },
    ],
  };
}

function boss(): LevelDef {
  const solids: Solid[] = [slab(0, 0, 0, 30, 30, 'stone')];
  solids.push(wall(0, 0, -14, 28, 5, 1.2, 'brick'));
  solids.push(wall(0, 0, 14, 28, 5, 1.2, 'brick'));
  solids.push(wall(-14, 0, 0, 1.2, 5, 28, 'brick'));
  solids.push(wall(14, 0, 0, 1.2, 5, 28, 'brick'));
  solids.push(wall(-5, 0, -3, 1.7, 1.35, 1.7, 'concrete'));
  solids.push(wall(5, 0, -3, 1.7, 1.35, 1.7, 'concrete'));
  solids.push(wall(-5, 0, 4, 1.7, 1.35, 1.7, 'concrete'));
  solids.push(wall(5, 0, 4, 1.7, 1.35, 1.7, 'concrete'));
  const bag = coinsOf('boss');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    bag.at(Math.cos(a) * 4.2, 1.2, Math.sin(a) * 4.2);
  }
  return {
    id: 'boss',
    name: 'Turtle King',
    sky: 0xd98962,
    fog: 0xe7b89a,
    fogNear: 14,
    fogFar: 46,
    camYaw: 0.95,
    camDist: 8.5,
    camHeight: 6.4,
    start: [0, 0, 8],
    killY: -6,
    solids,
    coins: bag.list,
    enemies: [],
    toads: [],
    pickups: [{ kind: 'flower', x: -8, y: 0, z: 6 }],
    cones: [],
    cars: [],
    breakables: [],
    checkpoints: [],
    pads: [],
    goal: null,
    portals: [],
    boss: true,
    water: null,
    pit: null,
    decors: [
      { t: 'crack', x: 0, y: 0.05, z: 0, w: 4, h: 0.04, d: 0.4 },
      { t: 'crack', x: 2, y: 0.05, z: -4, w: 2.5, h: 0.04, d: 0.3 },
      { t: 'pillar', x: -10, z: -10, h: 3.2 },
      { t: 'pillar', x: 10, z: -10, h: 3.2 },
      { t: 'pillar', x: -10, z: 10, h: 2.4 },
      { t: 'pillar', x: 10, z: 10, h: 2.4 },
    ],
  };
}

function fixHub(level: LevelDef): LevelDef {
  level.solids = level.solids.filter((s) => s.maxX - s.minX > 0.2 && s.maxZ - s.minZ > 0.2);
  return level;
}

export const LEVELS: Record<string, LevelDef> = {
  hub: fixHub(hub()),
  highway: highway(),
  mall: mall(),
  beach: beach(),
  boss: boss(),
};

export const HUB = LEVELS.hub as LevelDef;
