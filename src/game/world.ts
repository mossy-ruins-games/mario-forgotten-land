import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  makeBell,
  makeCage,
  makeCar,
  makeCone,
  makeFlag,
  makeFlowerItem,
  makeGoomba,
  makeHero,
  makeKoopa,
  makeMushroomItem,
  makePad,
  makeStarItem,
  makeToad,
  type HeroRig,
  type WalkerRig,
} from './actors';
import type { LevelDef, MatName } from './levels';
import { B, C, D, Geo, L, makeLabel, makeWaterTexture } from './materials';
import type { AABB } from './physics';
import type { SaveData } from './save';

export interface CoinRt {
  id: string;
  x: number;
  y: number;
  z: number;
  baseY: number;
  got: boolean;
  index: number;
}

export interface EnemyRt {
  kind: 'goomba' | 'koopa';
  x: number;
  y: number;
  z: number;
  axis: 'x' | 'z';
  min: number;
  max: number;
  dir: number;
  alive: boolean;
  radius: number;
  height: number;
  mesh: THREE.Group;
  rig: WalkerRig;
  speed: number;
}

export interface ToadRt {
  id: string;
  x: number;
  y: number;
  z: number;
  saved: boolean;
  already: boolean;
  rising: number;
  mesh: THREE.Group;
  head: THREE.Group;
  cage: THREE.Group;
}

export interface PickupRt {
  kind: 'mushroom' | 'flower' | 'star';
  x: number;
  y: number;
  z: number;
  baseY: number;
  got: boolean;
  mesh: THREE.Group;
}

export interface ConeRt {
  id: string;
  x: number;
  y: number;
  z: number;
  homeX: number;
  homeY: number;
  homeZ: number;
  carried: boolean;
  mesh: THREE.Group;
}

export interface CarRt {
  id: string;
  x: number;
  y: number;
  z: number;
  rot: number;
  homeX: number;
  homeY: number;
  homeZ: number;
  homeRot: number;
  occupied: boolean;
  mesh: THREE.Group;
  solid: AABB;
}

export interface BreakRt {
  id: string;
  mesh: THREE.Mesh;
  solid: AABB;
  broken: boolean;
}

export interface CpRt {
  id: string;
  x: number;
  y: number;
  z: number;
  mesh: THREE.Group;
  used: boolean;
}

export interface PadRt {
  x: number;
  y: number;
  z: number;
  power: number;
  mesh: THREE.Group;
}

export interface PortalRt {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  need: number;
  bars: THREE.Group | null;
}

export interface BuiltWorld {
  solids: AABB[];
  coins: CoinRt[];
  coinMesh: THREE.InstancedMesh | null;
  enemies: EnemyRt[];
  toads: ToadRt[];
  pickups: PickupRt[];
  cones: ConeRt[];
  cars: CarRt[];
  breaks: BreakRt[];
  checkpoints: CpRt[];
  pads: PadRt[];
  portals: PortalRt[];
  goal: { x: number; y: number; z: number; mesh: THREE.Group } | null;
  trashGeo: THREE.BufferGeometry[];
  trashTex: THREE.Texture[];
  trashMat: THREE.Material[];
  water: THREE.Mesh | null;
  luigi: HeroRig | null;
  killY: number;
}

const MAT: Record<MatName, number> = {
  grass: C.grass,
  road: C.road,
  sand: C.sand,
  stone: C.stone,
  tile: C.tile,
  wood: C.wood,
  brick: C.brick,
  plaster: C.plaster,
  dirt: C.dirt,
  concrete: C.concrete,
  metal: C.metal,
};

function boxGeo(x: number, y: number, z: number, w: number, h: number, d: number): THREE.BufferGeometry {
  const g = Geo.box.clone();
  g.scale(w, h, d);
  const attr = g.getAttribute('normal');
  for (let i = 0; i < attr.count; i++) {
    const nx = attr.getX(i);
    const ny = attr.getY(i);
    const nz = attr.getZ(i);
    const len = Math.hypot(nx, ny, nz) || 1;
    attr.setXYZ(i, nx / len, ny / len, nz / len);
  }
  g.translate(x, y, z);
  return g;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface InstanceItem {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  rotY?: number;
}

function addInstances(
  group: THREE.Group,
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  items: InstanceItem[],
): void {
  if (items.length === 0) return;
  const mesh = new THREE.InstancedMesh(geo, material, items.length);
  mesh.userData.keepGeo = true;
  const dummy = new THREE.Object3D();
  items.forEach((it, i) => {
    dummy.position.set(it.x, it.y, it.z);
    dummy.rotation.set(0, it.rotY ?? 0, 0);
    dummy.scale.set(it.sx, it.sy, it.sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);
}

export function buildWorld(level: LevelDef, group: THREE.Group, save: SaveData): BuiltWorld {
  const trashGeo: THREE.BufferGeometry[] = [];
  const trashTex: THREE.Texture[] = [];
  const trashMat: THREE.Material[] = [];
  const bins = new Map<number, THREE.BufferGeometry[]>();
  const decalBins = new Map<number, THREE.BufferGeometry[]>();
  const paint = (color: number, x: number, y: number, z: number, w: number, h: number, d: number, decal = false) => {
    const geo = boxGeo(x, y, z, w, h, d);
    const map = decal ? decalBins : bins;
    const list = map.get(color) ?? [];
    list.push(geo);
    map.set(color, list);
  };

  const solids: AABB[] = level.solids.map((s) => ({
    minX: s.minX,
    minY: s.minY,
    minZ: s.minZ,
    maxX: s.maxX,
    maxY: s.maxY,
    maxZ: s.maxZ,
    active: true,
  }));

  for (const s of level.solids) {
    const color = MAT[s.mat];
    const w = s.maxX - s.minX;
    const h = s.maxY - s.minY;
    const d = s.maxZ - s.minZ;
    paint(color, (s.minX + s.maxX) / 2, (s.minY + s.maxY) / 2, (s.minZ + s.maxZ) / 2, w, h, d);
  }

  const grass: InstanceItem[] = [];
  const rocks: InstanceItem[] = [];
  const rng = mulberry32(hash(level.id));
  let scattered = 0;
  for (const s of level.solids) {
    if (s.mat !== 'grass' && s.mat !== 'sand') continue;
    if (s.maxY > 0.2 && level.id === 'hub') continue;
    const area = (s.maxX - s.minX) * (s.maxZ - s.minZ);
    let n = Math.min(36, Math.floor(area * (level.id === 'hub' ? 0.035 : 0.07)));
    for (let i = 0; i < n && scattered < 160; i++) {
      const x = s.minX + rng() * (s.maxX - s.minX);
      const z = s.minZ + rng() * (s.maxZ - s.minZ);
      if (level.id === 'hub' && Math.hypot(x, z) < 9) continue;
      const sy = 0.28 + rng() * 0.22;
      if (s.mat === 'grass') grass.push({ x, y: s.maxY + sy / 2, z, sx: 0.16, sy, sz: 0.16, rotY: rng() * 6 });
      else rocks.push({ x, y: s.maxY + 0.08, z, sx: 0.16 + rng() * 0.1, sy: 0.12, sz: 0.14, rotY: rng() * 4 });
      scattered++;
    }
  }

  const trunks: InstanceItem[] = [];
  const tops: InstanceItem[] = [];
  const vines: InstanceItem[] = [];
  const clouds: InstanceItem[] = [];
  const pillars: InstanceItem[] = [];

  const trackLabel = (text: string, x: number, y: number, z: number) => {
    const label = makeLabel(text);
    label.sprite.position.set(x, y, z);
    group.add(label.sprite);
    trashTex.push(label.texture);
    trashMat.push(label.material);
  };

  for (const decor of level.decors) {
    const x = decor.x ?? 0;
    const y = decor.y ?? 0;
    const z = decor.z ?? 0;
    if (decor.t === 'building') {
      const w = decor.w ?? 8;
      const h = decor.h ?? 10;
      const d = decor.d ?? 8;
      const color = decor.color ?? C.plaster;
      paint(color, x, h / 2, z, w, h, d);
      paint(C.roof, x, h + 0.35, z, w + 0.5, 0.7, d + 0.5);
      const faceX = Math.abs(x) >= Math.abs(z);
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 2; col++) {
          const wy = 1.8 + row * 2.3;
          if (wy > h - 1.2) continue;
          const warm = (row + col) % 3 === 0;
          if (faceX) {
            const wx = x + Math.sign(x || 1) * (-w / 2 - 0.05);
            const wz = z - d * 0.22 + col * d * 0.44;
            paint(warm ? C.windowLit : C.window, wx, wy, wz, 0.12, 1.05, 0.85);
          } else {
            const wz = z + Math.sign(z || 1) * (-d / 2 - 0.05);
            const wx = x - w * 0.22 + col * w * 0.44;
            paint(warm ? C.windowLit : C.window, wx, wy, wz, 0.85, 1.05, 0.12);
          }
        }
      }
    } else if (decor.t === 'tree') {
      const s = decor.s ?? 1;
      trunks.push({ x, y: 0.7 * s, z, sx: 0.18 * s, sy: 1.4 * s, sz: 0.18 * s });
      tops.push({ x, y: 1.75 * s, z, sx: 0.85 * s, sy: 0.7 * s, sz: 0.85 * s });
      tops.push({ x: x + 0.1, y: 2.25 * s, z, sx: 0.55 * s, sy: 0.5 * s, sz: 0.55 * s });
    } else if (decor.t === 'palm') {
      const s = decor.s ?? 1;
      trunks.push({ x, y: 1.1 * s, z, sx: 0.14 * s, sy: 2.2 * s, sz: 0.14 * s });
      tops.push({ x, y: 2.3 * s, z, sx: 0.35 * s, sy: 0.25 * s, sz: 0.35 * s });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        tops.push({
          x: x + Math.cos(a) * 0.55 * s,
          y: 2.15 * s,
          z: z + Math.sin(a) * 0.55 * s,
          sx: 0.45 * s,
          sy: 0.12 * s,
          sz: 0.18 * s,
          rotY: a,
        });
      }
    } else if (decor.t === 'vine') {
      const vh = decor.h ?? 3;
      vines.push({ x, y: y - vh / 2, z, sx: 0.08, sy: vh, sz: 0.08 });
    } else if (decor.t === 'cloud') {
      clouds.push({ x, y, z, sx: 1.4, sy: 0.7, sz: 0.9 });
      clouds.push({ x: x + 1.1, y: y - 0.1, z, sx: 1, sy: 0.6, sz: 0.8 });
      clouds.push({ x: x - 1, y: y - 0.15, z: z + 0.2, sx: 0.9, sy: 0.55, sz: 0.7 });
    } else if (decor.t === 'pillar') {
      const ph = decor.h ?? 3;
      const r = decor.s ?? 0.28;
      pillars.push({ x, y: ph / 2, z, sx: r, sy: ph, sz: r });
    } else if (decor.t === 'crack' || decor.t === 'slab' || decor.t === 'beam') {
      const color = decor.t === 'crack' ? 0x5c6368 : (decor.color ?? (decor.t === 'beam' ? C.metal : C.stone));
      paint(color, x, y, z, decor.w ?? 1, decor.h ?? 0.08, decor.d ?? 1, decor.t !== 'beam');
    } else if (decor.t === 'rock') {
      const s = decor.s ?? 0.5;
      rocks.push({ x, y: y + s * 0.3, z, sx: s, sy: s * 0.7, sz: s, rotY: 0.4 });
    } else if (decor.t === 'car') {
      const car = makeCar(decor.color ?? C.rust);
      car.position.set(x, 0, z);
      car.rotation.y = decor.rot ?? 0;
      group.add(car);
    } else if (decor.t === 'bush') {
      const s = decor.s ?? 1;
      tops.push({ x, y: 0.35 * s, z, sx: 0.45 * s, sy: 0.32 * s, sz: 0.45 * s });
    } else if (decor.t === 'umbrella') {
      paint(decor.color ?? C.red, x, 1.6, z, 1.4, 0.12, 1.4);
      pillars.push({ x, y: 0.75, z, sx: 0.06, sy: 1.5, sz: 0.06 });
    } else if (decor.t === 'fountain') {
      paint(C.stone, 0, 0.35, -1.6, 2.6, 0.7, 2.6);
      paint(C.water, 0, 0.75, -1.6, 1.7, 0.18, 1.7);
    } else if (decor.t === 'sign' && decor.text) {
      trackLabel(decor.text, x, y, z);
    }
  }

  if (level.pit) {
    paint(C.pit, level.pit.x, level.pit.y, level.pit.z, level.pit.w, 0.2, level.pit.d);
  }

  const flush = (map: Map<number, THREE.BufferGeometry[]>, matFor: (color: number) => THREE.Material) => {
    for (const [color, geos] of map) {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) continue;
      if (geos.length > 1) geos.forEach((g) => g.dispose());
      trashGeo.push(merged);
      const mesh = new THREE.Mesh(merged, matFor(color));
      group.add(mesh);
    }
  };
  flush(bins, L);
  flush(decalBins, D);
  addInstances(group, Geo.cone, L(C.leaf), grass);
  addInstances(group, Geo.low, L(C.stone), rocks);
  addInstances(group, Geo.cyl, L(C.dirt), trunks);
  addInstances(group, Geo.low, L(C.leaf), tops);
  addInstances(group, Geo.cyl, L(C.vine), vines);
  addInstances(group, Geo.low, B(C.cloud), clouds);
  addInstances(group, Geo.cyl, L(C.concrete), pillars);

  const breaks: BreakRt[] = level.breakables.map((b) => {
    const mesh = new THREE.Mesh(Geo.box, L(C.brick));
    mesh.scale.set(b.w, b.h, b.d);
    mesh.position.set(b.x, b.base + b.h / 2, b.z);
    mesh.userData.keepGeo = true;
    group.add(mesh);
    const solid: AABB = {
      minX: b.x - b.w / 2,
      maxX: b.x + b.w / 2,
      minY: b.base,
      maxY: b.base + b.h,
      minZ: b.z - b.d / 2,
      maxZ: b.z + b.d / 2,
      active: true,
    };
    solids.push(solid);
    return { id: b.id, mesh, solid, broken: false };
  });

  const coins: CoinRt[] = level.coins.map((c, index) => ({
    id: c.id,
    x: c.x,
    y: c.y,
    z: c.z,
    baseY: c.y,
    got: save.collected.includes(c.id),
    index,
  }));
  let coinMesh: THREE.InstancedMesh | null = null;
  if (coins.length) {
    coinMesh = new THREE.InstancedMesh(Geo.coin, B(C.gold), coins.length);
    coinMesh.userData.keepGeo = true;
    group.add(coinMesh);
  }

  const enemies: EnemyRt[] = level.enemies.map((e) => {
    const rig = e.kind === 'goomba' ? makeGoomba() : makeKoopa();
    const y = 0;
    rig.root.position.set(e.x, y, e.z);
    group.add(rig.root);
    return {
      kind: e.kind,
      x: e.x,
      y,
      z: e.z,
      axis: e.axis,
      min: e.min,
      max: e.max,
      dir: 1,
      alive: true,
      radius: e.kind === 'goomba' ? 0.42 : 0.48,
      height: e.kind === 'goomba' ? 0.95 : 1.05,
      mesh: rig.root,
      rig,
      speed: e.kind === 'goomba' ? 1.65 : 2.25,
    };
  });
  for (const enemy of enemies) {
    let best = 0;
    for (const s of solids) {
      if (enemy.x < s.minX || enemy.x > s.maxX || enemy.z < s.minZ || enemy.z > s.maxZ) continue;
      if (s.maxY > best && s.maxY < 8) best = s.maxY;
    }
    enemy.y = best;
    enemy.mesh.position.y = best;
  }

  const toads: ToadRt[] = level.toads.map((t) => {
    const toad = makeToad(t.tint);
    const already = save.rescued.includes(t.id);
    const cage = makeCage();
    cage.visible = !already;
    const mesh = new THREE.Group();
    mesh.add(cage);
    mesh.add(toad.root);
    mesh.position.set(t.x, t.y, t.z);
    group.add(mesh);
    return {
      id: t.id,
      x: t.x,
      y: t.y,
      z: t.z,
      saved: already,
      already,
      rising: 0,
      mesh,
      head: toad.head,
      cage,
    };
  });

  const pickups: PickupRt[] = level.pickups.map((p) => {
    const mesh = p.kind === 'mushroom' ? makeMushroomItem() : p.kind === 'flower' ? makeFlowerItem() : makeStarItem();
    mesh.position.set(p.x, p.y, p.z);
    group.add(mesh);
    return { kind: p.kind, x: p.x, y: p.y, z: p.z, baseY: p.y, got: false, mesh };
  });

  const cones: ConeRt[] = level.cones.map((c) => {
    const mesh = makeCone();
    mesh.position.set(c.x, c.y, c.z);
    group.add(mesh);
    return { id: c.id, x: c.x, y: c.y, z: c.z, homeX: c.x, homeY: c.y, homeZ: c.z, carried: false, mesh };
  });

  const cars: CarRt[] = level.cars.map((c) => {
    const mesh = makeCar();
    mesh.position.set(c.x, c.y, c.z);
    mesh.rotation.y = c.rot;
    group.add(mesh);
    const solid: AABB = {
      minX: c.x - 1.15,
      maxX: c.x + 1.15,
      minY: c.y,
      maxY: c.y + 1.15,
      minZ: c.z - 1.15,
      maxZ: c.z + 1.15,
      active: true,
    };
    solids.push(solid);
    return {
      id: c.id,
      x: c.x,
      y: c.y,
      z: c.z,
      rot: c.rot,
      homeX: c.x,
      homeY: c.y,
      homeZ: c.z,
      homeRot: c.rot,
      occupied: false,
      mesh,
      solid,
    };
  });

  const checkpoints: CpRt[] = level.checkpoints.map((c) => {
    const mesh = makeBell();
    mesh.position.set(c.x, c.y, c.z);
    group.add(mesh);
    return { ...c, mesh, used: false };
  });

  const pads: PadRt[] = level.pads.map((p) => {
    const mesh = makePad();
    mesh.position.set(p.x, p.y, p.z);
    group.add(mesh);
    return { ...p, mesh };
  });

  const portals: PortalRt[] = level.portals.map((p) => {
    trackLabel(p.label, p.x, 3.5, p.z);
    let bars: THREE.Group | null = null;
    if (p.need > 0) {
      bars = new THREE.Group();
      for (const ox of [-1.4, 0, 1.4]) {
        const bar = new THREE.Mesh(Geo.box, L(C.metal));
        bar.userData.keepGeo = true;
        bar.scale.set(0.28, 2.3, 0.28);
        bar.position.set(ox, 1.15, 0);
        bars.add(bar);
      }
      bars.position.set(p.x, 0, p.z);
      group.add(bars);
    }
    return { id: p.id, x: p.x, z: p.z, w: p.w, d: p.d, need: p.need, bars };
  });

  let goal: BuiltWorld['goal'] = null;
  if (level.goal) {
    const mesh = makeFlag();
    mesh.position.set(level.goal[0], level.goal[1], level.goal[2]);
    group.add(mesh);
    goal = { x: level.goal[0], y: level.goal[1], z: level.goal[2], mesh };
  }

  let water: THREE.Mesh | null = null;
  if (level.water) {
    const tex = makeWaterTexture();
    const mat = new THREE.MeshLambertMaterial({ map: tex, color: C.water, transparent: true, opacity: 0.82 });
    trashTex.push(tex);
    trashMat.push(mat);
    water = new THREE.Mesh(new THREE.PlaneGeometry(level.water.w, level.water.d), mat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(level.water.x, level.water.y, level.water.z);
    group.add(water);
    trashGeo.push(water.geometry);
  }
  let luigi: HeroRig | null = null;
  if (level.id === 'hub') {
    luigi = makeHero('green');
    luigi.root.position.set(2.3, 0, 4.6);
    luigi.root.rotation.y = Math.PI * 0.85;
    group.add(luigi.root);
  }

  return {
    solids,
    coins,
    coinMesh,
    enemies,
    toads,
    pickups,
    cones,
    cars,
    breaks,
    checkpoints,
    pads,
    portals,
    goal,
    trashGeo,
    trashTex,
    trashMat,
    water,
    luigi,
    killY: level.killY,
  };
}
