export interface AABB {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  active?: boolean;
}

export interface Body {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
}

const SOLE = 0.1;

export function approach(cur: number, target: number, delta: number): number {
  if (cur < target) return Math.min(target, cur + delta);
  return Math.max(target, cur - delta);
}

export function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function overlap(x: number, y: number, z: number, r: number, h: number, s: AABB): boolean {
  return x + r > s.minX && x - r < s.maxX && y < s.maxY && y + h > s.minY && z + r > s.minZ && z - r < s.maxZ;
}

function sideHits(b: Body, radius: number, height: number, s: AABB): boolean {
  if (s.active === false) return false;
  const feet = b.y + SOLE;
  const head = b.y + height;
  if (head <= s.minY || feet >= s.maxY) return false;
  if (b.x + radius <= s.minX || b.x - radius >= s.maxX) return false;
  if (b.z + radius <= s.minZ || b.z - radius >= s.maxZ) return false;
  return true;
}

function resolveSide(
  b: Body,
  radius: number,
  height: number,
  solids: AABB[],
  stepHeight: number,
  axis: 'x' | 'z',
): void {
  for (let pass = 0; pass < 2; pass++) {
    for (const s of solids) {
      if (!sideHits(b, radius, height, s)) continue;
      const rise = s.maxY - b.y;
      if (rise > 0 && rise <= stepHeight && b.vy <= 0.25) {
        const oldY = b.y;
        b.y = s.maxY;
        let blocked = false;
        for (const o of solids) {
          if (o === s || o.active === false) continue;
          if (sideHits(b, radius, height, o)) {
            blocked = true;
            break;
          }
        }
        if (!blocked) continue;
        b.y = oldY;
      }
      if (axis === 'x') {
        const mid = (s.minX + s.maxX) * 0.5;
        b.x = b.x < mid ? s.minX - radius : s.maxX + radius;
        b.vx = 0;
      } else {
        const mid = (s.minZ + s.maxZ) * 0.5;
        b.z = b.z < mid ? s.minZ - radius : s.maxZ + radius;
        b.vz = 0;
      }
    }
  }
}

export function stepBody(
  b: Body,
  radius: number,
  height: number,
  dt: number,
  solids: AABB[],
  stepHeight = 0.55,
): void {
  b.x += b.vx * dt;
  resolveSide(b, radius, height, solids, stepHeight, 'x');
  b.z += b.vz * dt;
  resolveSide(b, radius, height, solids, stepHeight, 'z');
  const prevY = b.y;
  b.y += b.vy * dt;
  b.grounded = false;
  for (let pass = 0; pass < 3; pass++) {
    for (const s of solids) {
      if (s.active === false) continue;
      if (!overlap(b.x, b.y, b.z, radius, height, s)) continue;
      if (prevY >= s.maxY - 0.05) {
        if (b.vy <= 0) {
          b.y = s.maxY;
          b.vy = 0;
          b.grounded = true;
        } else if (b.y < s.maxY) {
          b.y = s.maxY;
        }
        continue;
      }
      if (prevY + height <= s.minY + 0.05 && b.vy >= 0) {
        b.y = s.minY - height;
        b.vy = 0;
        continue;
      }
      if (s.maxY >= b.y && s.maxY - b.y < height) {
        b.y = s.maxY;
        if (b.vy < 0) b.vy = 0;
        b.grounded = true;
      }
    }
  }
}

export function groundHeight(x: number, z: number, refY: number, solids: AABB[]): number | null {
  let best: number | null = null;
  for (const s of solids) {
    if (s.active === false) continue;
    if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue;
    if (s.maxY > refY + 0.45) continue;
    if (s.maxY < refY - 5) continue;
    if (best === null || s.maxY > best) best = s.maxY;
  }
  return best;
}

export function hitsSolid(x: number, y: number, z: number, pad: number, solids: AABB[]): AABB | null {
  for (const s of solids) {
    if (s.active === false) continue;
    if (
      x + pad > s.minX &&
      x - pad < s.maxX &&
      y + pad > s.minY &&
      y - pad < s.maxY &&
      z + pad > s.minZ &&
      z - pad < s.maxZ
    ) {
      return s;
    }
  }
  return null;
}

export function rayAabb(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  s: AABB,
): number | null {
  if (s.active === false) return null;
  let tmin = 0;
  let tmax = 1;
  const o = [ox, oy, oz];
  const d = [dx, dy, dz];
  const mins = [s.minX, s.minY, s.minZ];
  const maxs = [s.maxX, s.maxY, s.maxZ];
  for (let i = 0; i < 3; i++) {
    const di = d[i] ?? 0;
    const oi = o[i] ?? 0;
    const mn = mins[i] ?? 0;
    const mx = maxs[i] ?? 0;
    if (Math.abs(di) < 1e-8) {
      if (oi < mn || oi > mx) return null;
    } else {
      let t1 = (mn - oi) / di;
      let t2 = (mx - oi) / di;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}
