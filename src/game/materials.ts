import * as THREE from 'three';

export const Geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 10, 8),
  low: new THREE.SphereGeometry(1, 7, 5),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
  cone: new THREE.ConeGeometry(1, 1, 8),
  coin: new THREE.CylinderGeometry(1, 1, 0.16, 8),
  ring: new THREE.TorusGeometry(1, 0.08, 6, 20),
};

export const C = {
  red: 0xe23b32,
  redDark: 0xb3221c,
  green: 0x3aaa3a,
  greenDark: 0x217a28,
  blue: 0x2d4ec7,
  blueDark: 0x1c348f,
  skin: 0xf0c09a,
  hair: 0x3a2416,
  shoe: 0x4a2c16,
  gold: 0xf2c14b,
  white: 0xfff8ee,
  black: 0x1c1c1c,
  glove: 0xfffdf8,
  grass: 0x63b04a,
  road: 0x8b9094,
  sand: 0xe7cf8c,
  stone: 0x9aa1a6,
  tile: 0xd9c7a4,
  wood: 0xb5834a,
  brick: 0xa85b3e,
  plaster: 0xe7dccb,
  metal: 0x7e878c,
  rust: 0xb85c32,
  rustDark: 0x7a3e24,
  water: 0x3aa0d4,
  leaf: 0x2f8f45,
  vine: 0x2a7a3a,
  dirt: 0x7a5736,
  concrete: 0xc5bfb4,
  belly: 0xf3d98a,
  shell: 0x2f9a3a,
  koopa: 0xf2d25a,
  orange: 0xf08a24,
  pink: 0xf2a3b5,
  purple: 0x7a4ec8,
  cloud: 0xfffefe,
  pit: 0x2a343c,
  roof: 0x8d4a42,
  window: 0x31424f,
  windowLit: 0xf0c36a,
  cream: 0xfff1cf,
  teal: 0x2aa7a0,
};

const lambert = new Map<number, THREE.MeshLambertMaterial>();
const basic = new Map<number, THREE.MeshBasicMaterial>();
const decals = new Map<number, THREE.MeshLambertMaterial>();

export function L(color: number): THREE.MeshLambertMaterial {
  let m = lambert.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true });
    lambert.set(color, m);
  }
  return m;
}

export function B(color: number): THREE.MeshBasicMaterial {
  let m = basic.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color });
    basic.set(color, m);
  }
  return m;
}

export function D(color: number): THREE.MeshLambertMaterial {
  let m = decals.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({
      color,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    decals.set(color, m);
  }
  return m;
}

let shadowTex: THREE.CanvasTexture | null = null;

export function shadowMaterial(): THREE.MeshBasicMaterial {
  if (!shadowTex) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    if (!g) return new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
    const grd = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,0.42)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
    shadowTex.colorSpace = THREE.SRGBColorSpace;
  }
  return new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
}

const shadowGeo = new THREE.PlaneGeometry(1, 1);
let sharedShadow: THREE.MeshBasicMaterial | null = null;

export function makeShadow(scale = 1.2): THREE.Mesh {
  if (!sharedShadow) sharedShadow = shadowMaterial();
  const mesh = new THREE.Mesh(shadowGeo, sharedShadow);
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(scale, scale, 1);
  mesh.renderOrder = 2;
  mesh.userData.keepGeo = true;
  return mesh;
}

export function makeLabel(text: string, tint = '#fff8e8'): { sprite: THREE.Sprite; texture: THREE.Texture; material: THREE.SpriteMaterial } {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.1, 1.55, 1);
  if (g) {
    g.clearRect(0, 0, 512, 256);
    g.fillStyle = 'rgba(18, 26, 36, 0.78)';
    g.beginPath();
    g.roundRect(12, 48, 488, 160, 36);
    g.fill();
    g.font = '700 68px Trebuchet MS, Verdana, sans-serif';
    g.fillStyle = tint;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 256, 132);
  }
  return { sprite, texture: tex, material };
}

export function makeWaterTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (g) {
    g.fillStyle = '#2f95cc';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(255,255,255,0.38)';
    g.lineWidth = 4;
    for (let i = 0; i < 8; i++) {
      g.beginPath();
      g.moveTo(0, i * 16 + 8);
      g.bezierCurveTo(32, i * 16 + 2, 80, i * 16 + 16, 128, i * 16 + 6);
      g.stroke();
    }
  }
  return tex;
}

let starGeo: THREE.ExtrudeGeometry | null = null;

export function starGeometry(): THREE.ExtrudeGeometry {
  if (starGeo) return starGeo;
  const shape = new THREE.Shape();
  const spikes = 5;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 0.52 : 0.22;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  starGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false });
  starGeo.center();
  return starGeo;
}
