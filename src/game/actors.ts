import * as THREE from 'three';
import { B, C, Geo, L, makeShadow, starGeometry } from './materials';

export interface HeroRig {
  root: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  head: THREE.Group;
  flower: THREE.Group;
}

export interface WalkerRig {
  root: THREE.Group;
  body: THREE.Group;
  footL: THREE.Object3D;
  footR: THREE.Object3D;
  shell?: THREE.Object3D;
}

export interface BossRig {
  root: THREE.Group;
  shell: THREE.Group;
  head: THREE.Group;
  footL: THREE.Object3D;
  footR: THREE.Object3D;
}

const torus = new THREE.TorusGeometry(1, 0.28, 5, 8);

function add(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  color: number,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  basic = false,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, basic ? B(color) : L(color));
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.userData.keepGeo = true;
  parent.add(mesh);
  return mesh;
}

export function makeHero(kind: 'red' | 'green'): HeroRig {
  const root = new THREE.Group();
  const cap = kind === 'red' ? C.red : C.green;
  const shirt = cap;
  const overalls = kind === 'red' ? C.blue : C.blueDark;
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(-0.16, 0.58, 0);
  legR.position.set(0.16, 0.58, 0);
  root.add(legL, legR);
  add(legL, Geo.box, overalls, 0, -0.16, 0, 0.2, 0.28, 0.24);
  add(legR, Geo.box, overalls, 0, -0.16, 0, 0.2, 0.28, 0.24);
  add(legL, Geo.box, C.shoe, 0, -0.36, 0.08, 0.24, 0.16, 0.38);
  add(legR, Geo.box, C.shoe, 0, -0.36, 0.08, 0.24, 0.16, 0.38);

  add(root, Geo.box, shirt, 0, 0.86, 0, 0.52, 0.4, 0.34);
  add(root, Geo.box, overalls, 0, 0.7, 0.02, 0.46, 0.32, 0.3);
  add(root, Geo.box, overalls, -0.12, 0.98, 0.12, 0.1, 0.24, 0.08);
  add(root, Geo.box, overalls, 0.12, 0.98, 0.12, 0.1, 0.24, 0.08);
  add(root, Geo.sphere, C.gold, -0.1, 0.82, 0.18, 0.07, 0.07, 0.07);
  add(root, Geo.sphere, C.gold, 0.1, 0.82, 0.18, 0.07, 0.07, 0.07);

  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.position.set(-0.36, 0.98, 0);
  armR.position.set(0.36, 0.98, 0);
  root.add(armL, armR);
  add(armL, Geo.cyl, shirt, 0, -0.16, 0, 0.09, 0.28, 0.09);
  add(armR, Geo.cyl, shirt, 0, -0.16, 0, 0.09, 0.28, 0.09);
  add(armL, Geo.sphere, C.glove, 0, -0.34, 0, 0.12, 0.12, 0.12);
  add(armR, Geo.sphere, C.glove, 0, -0.34, 0, 0.12, 0.12, 0.12);

  const head = new THREE.Group();
  head.position.set(0, 1.22, 0);
  root.add(head);
  add(head, Geo.sphere, C.skin, 0, 0, 0, 0.34, 0.32, 0.32);
  add(head, Geo.sphere, cap, 0, 0.12, -0.02, 0.36, 0.26, 0.36);
  add(head, Geo.box, cap, 0, 0.02, 0.22, 0.5, 0.08, 0.28);
  add(head, Geo.sphere, C.skin, 0, -0.02, 0.3, 0.13, 0.11, 0.12);
  add(head, Geo.box, C.hair, 0, -0.1, 0.26, 0.3, 0.08, 0.12);
  add(head, Geo.sphere, C.white, -0.1, 0.04, 0.26, 0.08, 0.1, 0.06, true);
  add(head, Geo.sphere, C.white, 0.1, 0.04, 0.26, 0.08, 0.1, 0.06, true);
  add(head, Geo.sphere, C.black, -0.1, 0.03, 0.3, 0.045, 0.055, 0.04, true);
  add(head, Geo.sphere, C.black, 0.1, 0.03, 0.3, 0.045, 0.055, 0.04, true);
  add(head, Geo.sphere, C.pink, -0.18, -0.06, 0.22, 0.06, 0.04, 0.04);

  const flower = new THREE.Group();
  flower.position.set(0.16, 0.28, 0.08);
  flower.visible = false;
  head.add(flower);
  add(flower, Geo.sphere, C.gold, 0, 0, 0, 0.08, 0.08, 0.08, true);
  add(flower, Geo.sphere, C.red, 0.1, 0, 0, 0.07, 0.07, 0.05, true);
  add(flower, Geo.sphere, C.white, -0.08, 0.06, 0, 0.06, 0.06, 0.05, true);
  add(flower, Geo.sphere, C.white, 0, -0.09, 0, 0.06, 0.06, 0.05, true);

  const shadow = makeShadow(1.15);
  shadow.position.y = 0.04;
  root.add(shadow);
  if (kind === 'green') root.scale.set(0.96, 1.12, 0.96);
  return { root, legL, legR, armL, armR, head, flower };
}

export function animateHero(rig: HeroRig, time: number, speed: number, air: boolean, flutter: boolean, wave: boolean): void {
  const s = Math.sin(time * 11) * Math.min(1, speed / 4);
  if (wave) {
    rig.armR.rotation.x = -0.4;
    rig.armR.rotation.z = -0.8 + Math.sin(time * 6) * 0.5;
    rig.armL.rotation.x = 0.2;
    rig.armL.rotation.z = 0.1;
    rig.legL.rotation.x = 0;
    rig.legR.rotation.x = 0;
    return;
  }
  if (air) {
    const kick = flutter ? Math.sin(time * 28) : 0.2;
    rig.legL.rotation.x = flutter ? kick : 0.45;
    rig.legR.rotation.x = flutter ? -kick : -0.25;
    rig.armL.rotation.z = flutter ? 0.9 : 0.15;
    rig.armR.rotation.z = flutter ? -0.9 : -0.15;
    rig.armL.rotation.x = flutter ? -0.4 : -0.8;
    rig.armR.rotation.x = flutter ? -0.4 : 0.3;
  } else {
    rig.legL.rotation.x = s * 0.9;
    rig.legR.rotation.x = -s * 0.9;
    rig.armL.rotation.x = -s * 0.7;
    rig.armR.rotation.x = s * 0.7;
    rig.armL.rotation.z = 0.08;
    rig.armR.rotation.z = -0.08;
  }
}

export function makeGoomba(): WalkerRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  add(body, Geo.sphere, 0x8a4b2a, 0, 0.72, 0, 0.52, 0.38, 0.52);
  add(body, Geo.sphere, 0xf0c39a, 0, 0.46, 0.06, 0.32, 0.28, 0.3);
  add(body, Geo.sphere, C.white, -0.1, 0.52, 0.22, 0.1, 0.12, 0.06, true);
  add(body, Geo.sphere, C.white, 0.1, 0.52, 0.22, 0.1, 0.12, 0.06, true);
  add(body, Geo.sphere, C.black, -0.1, 0.5, 0.26, 0.05, 0.06, 0.04, true);
  add(body, Geo.sphere, C.black, 0.1, 0.5, 0.26, 0.05, 0.06, 0.04, true);
  add(body, Geo.box, C.hair, -0.12, 0.64, 0.2, 0.12, 0.05, 0.06);
  add(body, Geo.box, C.hair, 0.12, 0.64, 0.2, 0.12, 0.05, 0.06);
  const footL = add(root, Geo.box, 0xc9844a, -0.16, 0.1, 0.08, 0.22, 0.12, 0.32);
  const footR = add(root, Geo.box, 0xc9844a, 0.16, 0.1, 0.08, 0.22, 0.12, 0.32);
  const shadow = makeShadow(1.05);
  shadow.position.y = 0.03;
  root.add(shadow);
  return { root, body, footL, footR };
}

export function makeKoopa(): WalkerRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  add(body, Geo.sphere, C.koopa, 0, 0.48, 0.08, 0.28, 0.32, 0.26);
  add(body, Geo.sphere, C.cream, 0, 0.46, 0.22, 0.18, 0.22, 0.1);
  const shell = add(body, Geo.sphere, C.shell, 0, 0.58, -0.12, 0.46, 0.4, 0.42);
  add(shell, Geo.cone, C.greenDark, 0, 0.7, -0.1, 0.12, 0.28, 0.12);
  add(shell, Geo.cone, C.greenDark, 0.28, 0.35, 0, 0.1, 0.22, 0.1);
  add(shell, Geo.cone, C.greenDark, -0.28, 0.35, 0, 0.1, 0.22, 0.1);
  add(body, Geo.box, C.koopa, 0, 0.72, 0.28, 0.16, 0.1, 0.22);
  add(body, Geo.sphere, C.white, -0.07, 0.66, 0.3, 0.07, 0.08, 0.05, true);
  add(body, Geo.sphere, C.white, 0.07, 0.66, 0.3, 0.07, 0.08, 0.05, true);
  add(body, Geo.sphere, C.black, -0.07, 0.65, 0.34, 0.035, 0.045, 0.03, true);
  add(body, Geo.sphere, C.black, 0.07, 0.65, 0.34, 0.035, 0.045, 0.03, true);
  const footL = add(root, Geo.box, C.shoe, -0.14, 0.1, 0.06, 0.18, 0.12, 0.28);
  const footR = add(root, Geo.box, C.shoe, 0.14, 0.1, 0.06, 0.18, 0.12, 0.28);
  const shadow = makeShadow(1.15);
  shadow.position.y = 0.03;
  root.add(shadow);
  return { root, body, footL, footR, shell };
}

export function animateWalker(rig: WalkerRig, time: number, moving: boolean): void {
  const s = moving ? Math.sin(time * 10) : 0;
  rig.footL.position.z = s * 0.08;
  rig.footR.position.z = -s * 0.08;
  rig.body.position.y = Math.abs(s) * 0.06;
  rig.body.rotation.z = s * 0.08;
}

export function makeToad(spot: number): { root: THREE.Group; head: THREE.Group } {
  const root = new THREE.Group();
  add(root, Geo.sphere, C.white, -0.1, 0.08, 0.04, 0.1, 0.08, 0.12);
  add(root, Geo.sphere, C.white, 0.1, 0.08, 0.04, 0.1, 0.08, 0.12);
  add(root, Geo.box, C.blue, 0, 0.28, 0, 0.28, 0.26, 0.22);
  add(root, Geo.box, C.white, 0, 0.22, 0.1, 0.16, 0.16, 0.08);
  const head = new THREE.Group();
  head.position.set(0, 0.72, 0);
  root.add(head);
  add(head, Geo.sphere, C.white, 0, 0.05, 0, 0.48, 0.36, 0.48);
  add(head, Geo.sphere, spot, 0.18, 0.18, 0.12, 0.12, 0.08, 0.12);
  add(head, Geo.sphere, spot, -0.2, 0.16, -0.05, 0.11, 0.08, 0.11);
  add(head, Geo.sphere, spot, 0.02, 0.22, -0.16, 0.1, 0.07, 0.1);
  add(head, Geo.sphere, C.skin, 0, -0.12, 0.18, 0.22, 0.16, 0.12);
  add(head, Geo.sphere, C.white, -0.07, -0.08, 0.26, 0.07, 0.08, 0.04, true);
  add(head, Geo.sphere, C.white, 0.07, -0.08, 0.26, 0.07, 0.08, 0.04, true);
  add(head, Geo.sphere, C.black, -0.07, -0.09, 0.29, 0.035, 0.045, 0.03, true);
  add(head, Geo.sphere, C.black, 0.07, -0.09, 0.29, 0.035, 0.045, 0.03, true);
  const shadow = makeShadow(0.9);
  shadow.position.y = 0.03;
  root.add(shadow);
  return { root, head };
}

export function makeBoss(): BossRig {
  const root = new THREE.Group();
  add(root, Geo.sphere, C.koopa, 0, 0.7, 0.15, 0.7, 0.55, 0.55);
  add(root, Geo.sphere, C.belly, 0, 0.62, 0.42, 0.42, 0.38, 0.28);
  const shell = new THREE.Group();
  root.add(shell);
  add(shell, Geo.sphere, C.greenDark, 0, 0.85, -0.25, 1.05, 0.72, 0.95);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI - Math.PI / 2;
    add(shell, Geo.cone, C.cream, Math.sin(a) * 0.7, 1.15, -0.25 + Math.cos(a) * 0.35, 0.16, 0.42, 0.16);
  }
  const head = new THREE.Group();
  head.position.set(0, 1.05, 0.55);
  root.add(head);
  add(head, Geo.box, C.koopa, 0, 0, 0.15, 0.7, 0.42, 0.55);
  add(head, Geo.cone, C.cream, -0.22, 0.28, 0.05, 0.12, 0.32, 0.12);
  add(head, Geo.cone, C.cream, 0.22, 0.28, 0.05, 0.12, 0.32, 0.12);
  add(head, Geo.cone, C.red, -0.34, 0.2, -0.1, 0.1, 0.28, 0.1);
  add(head, Geo.cone, C.red, 0.34, 0.2, -0.1, 0.1, 0.28, 0.1);
  add(head, Geo.cone, C.red, 0, 0.32, -0.2, 0.1, 0.26, 0.1);
  add(head, Geo.sphere, C.white, -0.16, 0.08, 0.38, 0.12, 0.14, 0.08, true);
  add(head, Geo.sphere, C.white, 0.16, 0.08, 0.38, 0.12, 0.14, 0.08, true);
  add(head, Geo.sphere, C.black, -0.16, 0.06, 0.44, 0.06, 0.07, 0.04, true);
  add(head, Geo.sphere, C.black, 0.16, 0.06, 0.44, 0.06, 0.07, 0.04, true);
  add(head, Geo.box, C.hair, 0, -0.12, 0.4, 0.28, 0.06, 0.08);
  const footL = add(root, Geo.box, C.shoe, -0.38, 0.16, 0.2, 0.36, 0.18, 0.5);
  const footR = add(root, Geo.box, C.shoe, 0.38, 0.16, 0.2, 0.36, 0.18, 0.5);
  const armL = add(root, Geo.cyl, C.koopa, -0.78, 0.7, 0.1, 0.14, 0.16, 0.14);
  const armR = add(root, Geo.cyl, C.koopa, 0.78, 0.7, 0.1, 0.14, 0.16, 0.14);
  armL.rotation.z = Math.PI / 2;
  armR.rotation.z = Math.PI / 2;
  const shadow = makeShadow(2.4);
  shadow.position.y = 0.04;
  root.add(shadow);
  return { root, shell, head, footL, footR };
}

export function makeCone(): THREE.Group {
  const g = new THREE.Group();
  add(g, Geo.cyl, C.white, 0, 0.08, 0, 0.5, 0.16, 0.5);
  add(g, Geo.cone, C.orange, 0, 0.78, 0, 0.46, 1.2, 0.46);
  add(g, Geo.cyl, C.white, 0, 0.55, 0, 0.32, 0.12, 0.32);
  const shadow = makeShadow(1.3);
  shadow.position.y = 0.03;
  g.add(shadow);
  return g;
}

export function makeCar(color = C.rust): THREE.Group {
  const g = new THREE.Group();
  add(g, Geo.box, color, 0, 0.48, 0, 1.2, 0.46, 2.25);
  add(g, Geo.box, C.rustDark, 0, 0.86, -0.05, 1.02, 0.4, 1.15);
  add(g, Geo.box, 0xb7e3f5, 0, 0.9, 0.2, 0.84, 0.22, 0.4, true);
  const wheel = (x: number, z: number) => {
    const w = add(g, Geo.cyl, C.black, x, 0.24, z, 0.24, 0.16, 0.24);
    w.rotation.z = Math.PI / 2;
  };
  wheel(-0.62, 0.72);
  wheel(0.62, 0.72);
  wheel(-0.62, -0.72);
  wheel(0.62, -0.72);
  add(g, Geo.box, C.gold, -0.32, 0.5, 1.12, 0.2, 0.12, 0.06, true);
  add(g, Geo.box, C.gold, 0.32, 0.5, 1.12, 0.2, 0.12, 0.06, true);
  const shadow = makeShadow(2.1);
  shadow.position.y = 0.03;
  g.add(shadow);
  return g;
}

export function makeFlag(): THREE.Group {
  const g = new THREE.Group();
  add(g, Geo.cyl, C.metal, 0, 1.3, 0, 0.08, 2.6, 0.08);
  add(g, Geo.sphere, C.gold, 0, 2.65, 0, 0.16, 0.16, 0.16, true);
  const flag = add(g, Geo.box, C.red, 0.45, 2.25, 0, 0.8, 0.5, 0.08);
  flag.name = 'cloth';
  return g;
}

export function makeBell(): THREE.Group {
  const g = new THREE.Group();
  add(g, Geo.cyl, C.gold, 0, 0.55, 0, 0.06, 1.1, 0.06);
  add(g, Geo.sphere, C.gold, 0, 1.25, 0, 0.28, 0.28, 0.28);
  add(g, torus, C.gold, 0, 1.05, 0, 0.18, 0.18, 0.18);
  return g;
}

export function makeCage(): THREE.Group {
  const g = new THREE.Group();
  const posts: [number, number][] = [
    [-0.35, -0.35],
    [0.35, -0.35],
    [-0.35, 0.35],
    [0.35, 0.35],
  ];
  for (const [x, z] of posts) add(g, Geo.cyl, C.metal, x, 0.55, z, 0.05, 1.1, 0.05);
  add(g, Geo.box, C.metal, 0, 1.12, 0, 0.85, 0.08, 0.85);
  return g;
}

export function makeMushroomItem(): THREE.Group {
  const g = new THREE.Group();
  add(g, Geo.cyl, C.cream, 0, 0.22, 0, 0.18, 0.28, 0.18);
  add(g, Geo.sphere, C.red, 0, 0.48, 0, 0.36, 0.26, 0.36);
  add(g, Geo.sphere, C.white, 0.12, 0.55, 0.1, 0.1, 0.06, 0.1, true);
  add(g, Geo.sphere, C.white, -0.12, 0.5, -0.05, 0.08, 0.05, 0.08, true);
  return g;
}

export function makeFlowerItem(): THREE.Group {
  const g = new THREE.Group();
  add(g, Geo.cyl, C.green, 0, 0.28, 0, 0.06, 0.4, 0.06);
  add(g, Geo.sphere, C.red, 0, 0.58, 0, 0.22, 0.22, 0.1);
  add(g, Geo.sphere, C.gold, 0, 0.58, 0.06, 0.1, 0.1, 0.06, true);
  add(g, Geo.sphere, C.white, 0.16, 0.7, 0, 0.1, 0.1, 0.06, true);
  add(g, Geo.sphere, C.white, -0.16, 0.7, 0, 0.1, 0.1, 0.06, true);
  return g;
}

export function makeStarItem(): THREE.Group {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(starGeometry(), B(C.gold));
  mesh.scale.setScalar(0.72);
  mesh.position.y = 0.75;
  mesh.userData.keepGeo = true;
  g.add(mesh);
  return g;
}

export function makePad(): THREE.Group {
  const g = new THREE.Group();
  add(g, Geo.cyl, C.gold, 0, 0.08, 0, 0.7, 0.12, 0.7);
  add(g, Geo.cyl, C.red, 0, 0.16, 0, 0.48, 0.08, 0.48);
  return g;
}
