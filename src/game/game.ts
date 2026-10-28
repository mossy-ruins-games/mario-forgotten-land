import * as THREE from 'three';
import { animateHero, animateWalker, makeBoss, makeHero, makeStarItem, makeToad, type BossRig } from './actors';
import { AudioBus } from './audio';
import { Input } from './input';
import { LEVELS, type LevelDef } from './levels';
import { B, C, Geo } from './materials';
import { approach, clamp, groundHeight, hitsSolid, lerpAngle, rayAabb, stepBody } from './physics';
import { loadSave, writeSave, type SaveData } from './save';
import { TUNE } from './tuning';
import {
  buildWorld,
  type BreakRt,
  type BuiltWorld,
  type CarRt,
  type CoinRt,
  type ConeRt,
  type EnemyRt,
  type PickupRt,
  type ToadRt,
} from './world';

type Mode = 'title' | 'hub' | 'level' | 'pause' | 'results';
type Form = 'small' | 'big' | 'fire';
type Mouth = 'none' | 'cone' | 'car';
type BossState = 'intro' | 'chase' | 'telegraph' | 'lunge' | 'spin' | 'poundTell' | 'pound' | 'stun' | 'dead';

interface Player {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  rot: number;
  jumps: number;
  coyote: number;
  flutter: number;
  plunge: boolean;
  hp: number;
  form: Form;
  star: number;
  iframe: number;
  mouth: Mouth;
  attackCd: number;
  fireCd: number;
  spin: number;
}

interface Boss {
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  state: BossState;
  timer: number;
  next: 'spin' | 'pound';
  radius: number;
  height: number;
  rig: BossRig;
  shootCd: number;
  ringR: number;
  ringLive: boolean;
  ringHit: boolean;
  spin: number;
  deadSent: boolean;
}

interface Shot {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  friendly: boolean;
  active: boolean;
}

interface Spark {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

const STEP = 1 / 60;

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(58, 1, 0.12, 140);
  private input = new Input();
  private audio = new AudioBus();
  private save: SaveData = loadSave();
  private mode: Mode = 'title';
  private level: LevelDef | null = null;
  private world: BuiltWorld | null = null;
  private worldGroup = new THREE.Group();
  private hero = makeHero('red');
  private starMesh = makeStarItem();
  private player: Player = this.freshPlayer();
  private boss: Boss | null = null;
  private ring: THREE.Mesh | null = null;
  private ringMat: THREE.MeshBasicMaterial | null = null;
  private shots: Shot[] = [];
  private sparks: Spark[] = [];
  private parade: THREE.Group[] = [];
  private checkpoint = new THREE.Vector3();
  private look = new THREE.Vector3();
  private camTarget = new THREE.Vector3();
  private dummy = new THREE.Object3D();
  private time = 0;
  private levelTime = 0;
  private runCoins = 0;
  private acc = 0;
  private last = 0;
  private jumpBuffer = 0;
  private hintCd = 0;
  private bossInvuln = 0;
  private smashHold = 0;
  private suckLock = false;
  private bannerTimer = 0;
  private toastTimer = 0;
  private hurtFlash = 0;
  private shake = 0;
  private pausedFrom: 'hub' | 'level' = 'hub';
  private app: HTMLElement;
  private heartsEl: HTMLElement;
  private coinEl: HTMLElement;
  private friendEl: HTMLElement;
  private powerEl: HTMLElement;
  private bannerEl: HTMLElement;
  private toastEl: HTMLElement;
  private promptEl: HTMLElement;
  private hurtEl: HTMLElement;
  private bossWrap: HTMLElement;
  private bossFill: HTMLElement;
  private titleEl: HTMLElement;
  private pauseEl: HTMLElement;
  private resultsEl: HTMLElement;
  private townBtn: HTMLButtonElement;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x87c4ea);
    this.scene.add(new THREE.HemisphereLight(0xd7ecff, 0x6eae55, 0.95));
    const sun = new THREE.DirectionalLight(0xfff3d2, 1.15);
    sun.position.set(18, 28, 12);
    this.scene.add(sun);
    this.scene.add(this.worldGroup);
    this.scene.add(this.hero.root);
    this.scene.add(this.starMesh);
    this.starMesh.visible = false;
    this.app = must('app');
    this.heartsEl = must('hearts');
    this.coinEl = must('coin-count');
    this.friendEl = must('friend-count');
    this.powerEl = must('power-pill');
    this.bannerEl = must('banner');
    this.toastEl = must('toast');
    this.promptEl = must('prompt');
    this.hurtEl = must('hurt');
    this.bossWrap = must('boss-wrap');
    this.bossFill = must('boss-fill');
    this.titleEl = must('title');
    this.pauseEl = must('pause');
    this.resultsEl = must('results');
    this.townBtn = must('btn-town') as HTMLButtonElement;
    this.makeShots();
    this.bindUi();
    this.audio.setMuted(this.save.mute);
    this.resize();
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && (this.mode === 'hub' || this.mode === 'level')) this.pause();
    });
    window.addEventListener('pointerdown', () => this.audio.unlock());
    if (new URLSearchParams(location.search).has('debug')) {
      window.__GAME = {
        enter: (id: string) => this.enterLevel(id),
        play: () => this.onPlay(),
        state: () => this.snapshot(),
        unlock: () => this.debugUnlock(),
        give: (form) => {
          if (form === 'star') this.player.star = 10;
          else this.player.form = form;
        },
        tp: (x: number, y: number, z: number) => {
          this.player.x = x;
          this.player.y = y;
          this.player.z = z;
          this.player.vx = this.player.vy = this.player.vz = 0;
        },
      };
    }
    this.showTitle();
    requestAnimationFrame((t) => this.frame(t));
  }

  private freshPlayer(): Player {
    return {
      x: 0, y: 0, z: 8, vx: 0, vy: 0, vz: 0, grounded: true, rot: Math.PI,
      jumps: 0, coyote: 0.14, flutter: 0, plunge: false, hp: TUNE.maxHp,
      form: 'small', star: 0, iframe: 0, mouth: 'none', attackCd: 0, fireCd: 0, spin: 0,
    };
  }

  private bindUi(): void {
    must('btn-play').addEventListener('click', () => this.onPlay());
    must('btn-resume').addEventListener('click', () => this.resume());
    must('btn-town').addEventListener('click', () => {
      if (this.pausedFrom === 'hub') this.showTitle();
      else this.enterHub();
    });
    must('btn-results-ok').addEventListener('click', () => this.enterHub());
    must('btn-pause').addEventListener('click', () => {
      if (this.mode === 'hub' || this.mode === 'level') this.pause();
    });
    must('btn-mute').addEventListener('click', () => this.toggleMute());
    must('btn-pause-mute').addEventListener('click', () => this.toggleMute());
    must('btn-full').addEventListener('click', () => this.toggleFull());
  }

  private frame(now: number): void {
    if (!this.last) this.last = now;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < 3) {
      this.sim(STEP);
      this.acc -= STEP;
      steps++;
    }
    this.tickUi(dt);
    this.updateSparks(dt);
    this.animate(dt);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((t) => this.frame(t));
  }

  private sim(dt: number): void {
    this.input.preUpdate();
    if (this.input.mutePressed) this.toggleMute();
    if (this.input.pausePressed) {
      if (this.mode === 'pause') this.resume();
      else if (this.mode === 'hub' || this.mode === 'level') {
        this.pause();
        this.input.endFrame();
        return;
      }
    }
    if (this.mode !== 'hub' && this.mode !== 'level') {
      this.input.endFrame();
      return;
    }
    const world = this.world;
    const level = this.level;
    if (!world || !level) {
      this.input.endFrame();
      return;
    }
    if (this.mode === 'level') this.levelTime += dt;
    const p = this.player;
    if (p.star > 0) p.star = Math.max(0, p.star - dt);
    if (p.iframe > 0) p.iframe = Math.max(0, p.iframe - dt);
    if (p.attackCd > 0) p.attackCd = Math.max(0, p.attackCd - dt);
    if (p.fireCd > 0) p.fireCd = Math.max(0, p.fireCd - dt);
    if (p.spin > 0) p.spin = Math.max(0, p.spin - dt);
    if (this.hintCd > 0) this.hintCd -= dt;
    if (this.bossInvuln > 0) this.bossInvuln = Math.max(0, this.bossInvuln - dt);
    if (this.boss) this.updateBoss(dt);

    this.updateEnemies(dt);
    const yaw = level.camYaw;
    const ix = this.input.x;
    const iy = this.input.y;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    let mx = fx * iy + rx * ix;
    let mz = fz * iy + rz * ix;
    const mag = Math.hypot(mx, mz);
    if (mag > 1) {
      mx /= mag;
      mz /= mag;
    }
    const speed = p.mouth === 'car' ? TUNE.carSpeed : p.mouth === 'cone' ? TUNE.coneSpeed : TUNE.speed;
    const accel = p.grounded ? 42 : 24;
    p.vx = approach(p.vx, mx * speed, accel * dt);
    p.vz = approach(p.vz, mz * speed, accel * dt);
    if (mag > 0.2) p.rot = lerpAngle(p.rot, Math.atan2(mx, mz), 1 - Math.exp(-12 * dt));

    if (this.input.attackPressed) this.onAttack();
    if (this.input.inhalePressed) this.onAction();
    if (!this.input.inhaleHeld) this.suckLock = false;

    if (this.input.jumpPressed) this.jumpBuffer = TUNE.buffer;
    if (this.jumpBuffer > 0) {
      this.jumpBuffer -= dt;
      const canFirst = p.grounded || p.coyote > 0;
      const canSecond = !p.grounded && p.coyote <= 0 && p.jumps === 1 && p.mouth !== 'car';
      if ((canFirst || canSecond) && p.mouth !== 'car') {
        this.tryJump(p.mouth === 'cone' ? 0.82 : 1);
        this.jumpBuffer = 0;
      }
    }

    const fluttering = p.flutter > 0 && this.input.jumpHeld && p.vy < 1.5 && p.mouth === 'none';
    if (p.flutter > 0 && !this.input.jumpHeld) p.flutter = 0;
    if (!p.grounded) {
      p.vy -= (fluttering ? TUNE.flutterG : TUNE.gravity) * dt;
      if (fluttering) p.flutter -= dt;
      if (p.vy < -22) p.vy = -22;
    }

    stepBody(p, this.radius(), this.bodyHeight(), dt, world.solids, TUNE.step);
    if (p.grounded) {
      p.coyote = TUNE.coyote;
      p.jumps = 0;
      p.flutter = 0;
      if (p.plunge) this.landPlunge();
      for (const pad of world.pads) {
        if (Math.hypot(p.x - pad.x, p.z - pad.z) < 1.05 && Math.abs(p.y - pad.y) < 0.45) {
          p.vy = pad.power;
          p.grounded = false;
          p.jumps = 1;
          this.audio.sfx('boing');
          this.burst(pad.x, pad.y + 0.3, pad.z, C.gold, 6);
        }
      }
    } else {
      p.coyote = Math.max(0, p.coyote - dt);
    }

    if (p.y < world.killY) {
      this.fall();
      this.input.endFrame();
      return;
    }

    this.touchCoins();
    this.touchPickups();
    this.touchToads();
    this.touchEnemies();
    this.updateShots(dt);
    this.suck();
    this.smash(dt);
    this.touchCheckpoints();
    if (this.tryPortals()) return;
    this.tryGoal();
    this.input.endFrame();
  }

  private onAttack(): void {
    const p = this.player;
    if (p.mouth === 'car') {
      p.vx += Math.sin(p.rot) * 7;
      p.vz += Math.cos(p.rot) * 7;
      this.audio.sfx('honk');
      return;
    }
    if (p.mouth === 'cone') {
      p.vx += Math.sin(p.rot) * 8;
      p.vz += Math.cos(p.rot) * 8;
      this.audio.sfx('kick');
      return;
    }
    if (!p.grounded) {
      p.plunge = true;
      p.vy = Math.min(p.vy, TUNE.stompV);
      this.audio.sfx('stomp');
      return;
    }
    if (p.form === 'fire') this.shoot(true);
    else this.spin();
  }

  private onAction(): void {
    const world = this.world;
    const p = this.player;
    if (!world) return;
    if (p.mouth !== 'none') {
      this.exitMouth(false);
      this.suckLock = true;
      this.audio.sfx('click');
      return;
    }
    const car = this.nearestCar();
    if (car) {
      this.enterCar(car);
      this.suckLock = true;
      return;
    }
    const cone = this.nearestCone();
    if (cone) {
      cone.carried = true;
      p.mouth = 'cone';
      this.suckLock = true;
      this.audio.sfx('click');
      return;
    }
  }

  private tryJump(mult: number): void {
    const p = this.player;
    if (p.grounded || p.coyote > 0) {
      p.vy = TUNE.jumpV * mult;
      p.grounded = false;
      p.coyote = 0;
      p.jumps = 1;
      p.flutter = 0;
      this.audio.sfx('jump');
      this.buzz(8);
      return;
    }
    if (p.jumps < 2) {
      p.vy = TUNE.doubleV * mult;
      p.jumps = 2;
      p.flutter = TUNE.flutterTime;
      this.audio.sfx('flutter');
      this.buzz(8);
    }
  }

  private spin(): void {
    const p = this.player;
    const world = this.world;
    if (!world || p.attackCd > 0) return;
    p.attackCd = 0.38;
    p.spin = 0.22;
    this.audio.sfx('kick');
    const fx = Math.sin(p.rot);
    const fz = Math.cos(p.rot);
    for (const enemy of world.enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.x - p.x;
      const dz = enemy.z - p.z;
      if (Math.hypot(dx, dz) < 1.4 && dx * fx + dz * fz > -0.2) this.defeatEnemy(enemy);
    }
  }

  private shoot(friendly: boolean, x?: number, y?: number, z?: number, vx?: number, vy?: number, vz?: number): void {
    const p = this.player;
    if (friendly && p.fireCd > 0) return;
    if (friendly) p.fireCd = 0.34;
    const shot = this.shots.find((s) => !s.active);
    if (!shot) return;
    const dirX = Math.sin(p.rot);
    const dirZ = Math.cos(p.rot);
    shot.active = true;
    shot.friendly = friendly;
    shot.life = friendly ? 1.25 : 2.4;
    shot.x = x ?? p.x + dirX * 0.8;
    shot.y = y ?? p.y + 1.05;
    shot.z = z ?? p.z + dirZ * 0.8;
    shot.vx = vx ?? dirX * 13;
    shot.vy = vy ?? 2.2;
    shot.vz = vz ?? dirZ * 13;
    shot.mesh.visible = true;
    shot.mesh.material = friendly ? B(C.gold) : B(0xff4422);
    if (friendly) this.audio.sfx('fire');
  }

  private updateShots(dt: number): void {
    const world = this.world;
    if (!world) return;
    const p = this.player;
    for (const shot of this.shots) {
      if (!shot.active) continue;
      shot.life -= dt;
      shot.vy -= 12 * dt;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.z += shot.vz * dt;
      shot.mesh.position.set(shot.x, shot.y, shot.z);
      if (shot.life <= 0 || shot.y < -3) {
        this.killShot(shot);
        continue;
      }
      const solid = hitsSolid(shot.x, shot.y, shot.z, 0.18, world.solids);
      if (solid) {
        if (shot.friendly) {
          const wall = world.breaks.find((b) => b.solid === solid && !b.broken);
          if (wall) this.breakWall(wall);
        }
        this.killShot(shot);
        continue;
      }
      if (shot.friendly) {
        for (const enemy of world.enemies) {
          if (!enemy.alive) continue;
          if (Math.hypot(enemy.x - shot.x, enemy.z - shot.z) < enemy.radius + 0.25 && Math.abs(enemy.y + 0.45 - shot.y) < 0.9) {
            this.defeatEnemy(enemy);
            this.killShot(shot);
          }
        }
        if (this.boss && this.boss.state !== 'dead' && Math.hypot(this.boss.x - shot.x, this.boss.z - shot.z) < this.boss.radius + 0.2 && shot.y < 2) {
          this.hitBoss(true);
          this.killShot(shot);
        }
      } else if (Math.hypot(p.x - shot.x, p.z - shot.z) < 0.62 && Math.abs(p.y + 0.7 - shot.y) < 1.1) {
        this.hurt();
        this.killShot(shot);
      }
    }
  }

  private killShot(shot: Shot): void {
    shot.active = false;
    shot.mesh.visible = false;
  }

  private suck(): void {
    const world = this.world;
    const p = this.player;
    if (!world) return;
    const sucking = this.input.inhaleHeld && !this.suckLock && p.mouth === 'none';
    this.audio.setInhale(sucking);
    if (!sucking) return;
    const fx = Math.sin(p.rot);
    const fz = Math.cos(p.rot);
    const mx = p.x + fx * 0.3;
    const my = p.y + 1;
    const mz = p.z + fz * 0.3;
    const pull = (x: number, y: number, z: number): { x: number; y: number; z: number; dist: number } | null => {
      const dx = x - mx;
      const dy = y - my;
      const dz = z - mz;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 7.4 || dist < 0.001) return dist < 0.001 ? { x, y, z, dist } : null;
      const dot = (dx / dist) * fx + (dz / dist) * fz;
      if (dot < 0.42) return null;
      const step = Math.min(dist, 11 * STEP);
      return { x: x - (dx / dist) * step, y: y - (dy / dist) * step * 0.65, z: z - (dz / dist) * step, dist };
    };
    for (const coin of world.coins) {
      if (coin.got) continue;
      const next = pull(coin.x, coin.baseY, coin.z);
      if (!next) continue;
      coin.x = next.x;
      coin.baseY = next.y;
      coin.z = next.z;
      if (next.dist < 1.15) this.collectCoin(coin);
    }
    for (const item of world.pickups) {
      if (item.got) continue;
      const next = pull(item.x, item.baseY, item.z);
      if (!next) continue;
      item.x = next.x;
      item.baseY = next.y;
      item.z = next.z;
      item.mesh.position.set(item.x, item.baseY, item.z);
      if (next.dist < 1.15) this.takePickup(item);
    }
    for (const enemy of world.enemies) {
      if (!enemy.alive) continue;
      const next = pull(enemy.x, enemy.y, enemy.z);
      if (!next) continue;
      enemy.x = next.x;
      enemy.z = next.z;
      if (next.dist < 1.2) this.defeatEnemy(enemy);
    }
    for (const toad of world.toads) {
      if (toad.saved) continue;
      const next = pull(toad.x, toad.y, toad.z);
      if (!next) continue;
      toad.x = next.x;
      toad.z = next.z;
      toad.mesh.position.set(toad.x, toad.y, toad.z);
      if (next.dist < 1.25) this.rescue(toad);
    }
    if (this.boss && this.boss.state !== 'dead' && this.hintCd <= 0) {
      const dist = Math.hypot(this.boss.x - p.x, this.boss.z - p.z);
      if (dist < 7) {
        this.toast('Too big!');
        this.hintCd = 1.4;
      }
    }
  }

  private smash(dt: number): void {
    const world = this.world;
    const p = this.player;
    if (!world || p.mouth === 'none') {
      this.smashHold = 0;
      return;
    }
    let pressed = false;
    for (const wall of world.breaks) {
      if (wall.broken) continue;
      const cx = (wall.solid.minX + wall.solid.maxX) / 2;
      const cz = (wall.solid.minZ + wall.solid.maxZ) / 2;
      if (Math.hypot(p.x - cx, p.z - cz) < this.radius() + 0.85) pressed = true;
    }
    this.smashHold = pressed ? this.smashHold + dt : 0;
    const fast = Math.hypot(p.vx, p.vz) > 4.6 || this.input.attackPressed || this.smashHold > 0.22;
    if (!fast) return;
    for (const wall of world.breaks) {
      if (wall.broken) continue;
      const cx = (wall.solid.minX + wall.solid.maxX) / 2;
      const cz = (wall.solid.minZ + wall.solid.maxZ) / 2;
      if (Math.hypot(p.x - cx, p.z - cz) < this.radius() + 0.9) this.breakWall(wall);
    }
  }

  private landPlunge(): void {
    const world = this.world;
    const p = this.player;
    p.plunge = false;
    if (!world) return;
    this.audio.sfx('stomp');
    this.burst(p.x, p.y + 0.2, p.z, C.cream, 8);
    for (const enemy of world.enemies) {
      if (!enemy.alive) continue;
      if (Math.hypot(enemy.x - p.x, enemy.z - p.z) < 1.75 && Math.abs(enemy.y - p.y) < 1.4) this.defeatEnemy(enemy);
    }
    for (const wall of world.breaks) {
      if (wall.broken) continue;
      const cx = (wall.solid.minX + wall.solid.maxX) / 2;
      const cz = (wall.solid.minZ + wall.solid.maxZ) / 2;
      if (Math.hypot(p.x - cx, p.z - cz) < 1.9) this.breakWall(wall);
    }
  }

  private updateEnemies(dt: number): void {
    const world = this.world;
    if (!world) return;
    for (const enemy of world.enemies) {
      if (!enemy.alive) continue;
      if (enemy.axis === 'x') enemy.x += enemy.dir * enemy.speed * dt;
      else enemy.z += enemy.dir * enemy.speed * dt;
      const aheadX = enemy.x + (enemy.axis === 'x' ? enemy.dir * 0.55 : 0);
      const aheadZ = enemy.z + (enemy.axis === 'z' ? enemy.dir * 0.55 : 0);
      const here = groundHeight(enemy.x, enemy.z, enemy.y + 0.4, world.solids);
      const ahead = groundHeight(aheadX, aheadZ, enemy.y + 0.4, world.solids);
      const out = enemy.axis === 'x' ? enemy.x < enemy.min || enemy.x > enemy.max : enemy.z < enemy.min || enemy.z > enemy.max;
      if (out || ahead === null || (here !== null && ahead < here - 0.35)) {
        enemy.dir *= -1;
        if (enemy.axis === 'x') enemy.x = clamp(enemy.x, enemy.min, enemy.max);
        else enemy.z = clamp(enemy.z, enemy.min, enemy.max);
      }
      if (here !== null) enemy.y = here;
      const faceX = enemy.axis === 'x' ? enemy.dir : 0;
      const faceZ = enemy.axis === 'z' ? enemy.dir : 0;
      enemy.mesh.rotation.y = Math.atan2(faceX, faceZ);
    }
  }

  private touchEnemies(): void {
    const world = this.world;
    if (!world) return;
    for (const enemy of world.enemies) {
      if (!enemy.alive) continue;
      const kind = this.foeTouch(enemy.x, enemy.y, enemy.z, enemy.radius, enemy.height, true);
      if (kind === 'stomp' || this.player.star > 0 || this.player.mouth !== 'none') {
        if (kind !== 'none' || this.overlaps(enemy.x, enemy.y, enemy.z, enemy.radius, enemy.height)) {
          if (kind === 'none' && this.player.star <= 0 && this.player.mouth === 'none') continue;
          if (kind === 'none' && !this.overlaps(enemy.x, enemy.y, enemy.z, enemy.radius, enemy.height)) continue;
          this.defeatEnemy(enemy);
          if (kind === 'stomp') this.bounceOff();
        }
      } else if (kind === 'hurt') this.hurt();
    }
    if (!this.boss || this.boss.state === 'dead') return;
    const spiky = this.boss.state === 'spin' || this.boss.state === 'pound';
    const kind = this.foeTouch(this.boss.x, this.boss.y, this.boss.z, this.boss.radius, this.boss.height, !spiky);
    if (kind === 'stomp') {
      this.hitBoss(false);
      this.bounceOff();
    } else if (kind === 'hurt') {
      if (this.player.star > 0) this.hitBoss(true);
      else if (spiky || this.boss.state === 'lunge') this.hurt();
    }
  }

  private foeTouch(x: number, y: number, z: number, radius: number, height: number, canStomp: boolean): 'stomp' | 'hurt' | 'none' {
    const p = this.player;
    const dist = Math.hypot(p.x - x, p.z - z);
    if (dist > radius + this.radius() * 0.95) return 'none';
    const falling = p.vy < -0.05 || p.plunge;
    if (canStomp && falling && p.y > y + height * 0.36) return 'stomp';
    if (p.y < y + height * 0.62 && p.y + this.bodyHeight() > y + 0.1) return 'hurt';
    return 'none';
  }

  private overlaps(x: number, y: number, z: number, radius: number, height: number): boolean {
    const p = this.player;
    return Math.hypot(p.x - x, p.z - z) < radius + this.radius() && p.y < y + height && p.y + this.bodyHeight() > y;
  }

  private bounceOff(): void {
    const p = this.player;
    p.vy = this.input.jumpHeld ? 12 : 9.6;
    p.grounded = false;
    p.plunge = false;
    p.jumps = 1;
    p.flutter = 0;
  }

  private defeatEnemy(enemy: EnemyRt): void {
    if (!enemy.alive) return;
    enemy.alive = false;
    enemy.mesh.visible = false;
    this.audio.sfx('stomp');
    this.burst(enemy.x, enemy.y + 0.4, enemy.z, enemy.kind === 'koopa' ? C.shell : 0x8a4b2a, 8);
    this.save.coins += 1;
    this.runCoins += 1;
    this.persist();
    this.buzz(10);
  }

  private touchCoins(): void {
    const world = this.world;
    const p = this.player;
    if (!world) return;
    for (const coin of world.coins) {
      if (coin.got) continue;
      if (Math.hypot(coin.x - p.x, coin.z - p.z) < 0.95 && Math.abs(coin.baseY - (p.y + 0.8)) < 1.3) this.collectCoin(coin);
    }
  }

  private collectCoin(coin: CoinRt): void {
    if (coin.got) return;
    coin.got = true;
    if (!this.save.collected.includes(coin.id)) {
      this.save.collected.push(coin.id);
      this.save.coins += 1;
      this.runCoins += 1;
      this.persist();
    }
    this.audio.sfx('coin');
    this.burst(coin.x, coin.baseY, coin.z, C.gold, 5);
    this.buzz(6);
  }

  private touchPickups(): void {
    const world = this.world;
    const p = this.player;
    if (!world) return;
    for (const item of world.pickups) {
      if (item.got) continue;
      if (Math.hypot(item.x - p.x, item.z - p.z) < 1.05 && Math.abs(item.baseY - p.y) < 1.6) this.takePickup(item);
    }
  }

  private takePickup(item: PickupRt): void {
    if (item.got) return;
    item.got = true;
    item.mesh.visible = false;
    if (item.kind === 'mushroom') {
      if (this.player.form === 'small') this.player.form = 'big';
      else this.player.hp = Math.min(TUNE.maxHp, this.player.hp + 1);
      this.toast('Big!');
    } else if (item.kind === 'flower') {
      this.player.form = 'fire';
      this.toast('Fire!');
    } else {
      this.player.star = 10;
      this.toast('Star!');
    }
    this.audio.sfx('power');
    this.burst(item.x, item.baseY + 0.4, item.z, C.gold, 8);
  }

  private touchToads(): void {
    const world = this.world;
    const p = this.player;
    if (!world) return;
    for (const toad of world.toads) {
      if (toad.saved) continue;
      if (Math.hypot(toad.x - p.x, toad.z - p.z) < 1.15 && Math.abs(toad.y - p.y) < 1.5) this.rescue(toad);
    }
  }

  private rescue(toad: ToadRt): void {
    if (toad.saved) return;
    toad.saved = true;
    toad.rising = 1.15;
    toad.cage.visible = false;
    if (!this.save.rescued.includes(toad.id)) {
      this.save.rescued.push(toad.id);
      this.persist();
    }
    this.audio.sfx('rescue');
    this.toast('Friend saved!');
    this.burst(toad.x, toad.y + 0.8, toad.z, C.gold, 10);
  }

  private touchCheckpoints(): void {
    const world = this.world;
    const level = this.level;
    const p = this.player;
    if (!world || !level || level.id === 'hub') return;
    for (const cp of world.checkpoints) {
      if (cp.used) continue;
      if (Math.hypot(p.x - cp.x, p.z - cp.z) < 1.2 && Math.abs(p.y - cp.y) < 1.8) {
        cp.used = true;
        this.checkpoint.set(cp.x, cp.y, cp.z);
        this.save.checkpoint[level.id] = { x: cp.x, y: cp.y, z: cp.z };
        p.hp = Math.min(TUNE.maxHp, p.hp + 2);
        this.persist();
        this.toast('Checkpoint!');
        this.audio.sfx('check');
        this.burst(cp.x, cp.y + 1.3, cp.z, C.gold, 8);
      }
    }
  }

  private tryPortals(): boolean {
    const world = this.world;
    const p = this.player;
    if (!world || this.level?.id !== 'hub') return false;
    for (const portal of world.portals) {
      if (Math.abs(p.x - portal.x) > portal.w / 2 || Math.abs(p.z - portal.z) > portal.d / 2) continue;
      const locked = portal.need > 0 && this.save.rescued.length < portal.need && !this.save.bossCleared;
      if (locked) {
        if (this.hintCd <= 0) {
          this.toast(`Save ${portal.need} friends first! (${this.save.rescued.length}/${portal.need})`);
          this.hintCd = 1.5;
        }
        const len = Math.hypot(p.x, p.z) || 1;
        p.x -= (p.x / len) * 0.85;
        p.z -= (p.z / len) * 0.85;
        p.vy = Math.max(p.vy, 7);
        return false;
      }
      this.enterLevel(portal.id);
      return true;
    }
    return false;
  }

  private tryGoal(): void {
    const goal = this.world?.goal;
    const p = this.player;
    if (!goal || this.mode !== 'level') return;
    if (Math.hypot(p.x - goal.x, p.z - goal.z) < 1.35 && Math.abs(p.y - goal.y) < 2.2) this.finish(false);
  }

  private breakWall(wall: BreakRt): void {
    if (wall.broken) return;
    wall.broken = true;
    wall.solid.active = false;
    wall.mesh.visible = false;
    const x = (wall.solid.minX + wall.solid.maxX) / 2;
    const y = (wall.solid.minY + wall.solid.maxY) / 2;
    const z = (wall.solid.minZ + wall.solid.maxZ) / 2;
    this.audio.sfx('break');
    this.burst(x, y, z, C.brick, 12);
  }

  private hurt(): void {
    const p = this.player;
    if (p.iframe > 0 || p.star > 0 || p.mouth !== 'none') return;
    if (p.form === 'big' || p.form === 'fire') {
      p.form = 'small';
      p.iframe = 1.5;
      this.audio.sfx('shrink');
    } else {
      p.hp -= 1;
      p.iframe = 1.5;
      this.audio.sfx('hurt');
      this.buzz(20);
      if (p.hp <= 0) {
        p.hp = TUNE.maxHp;
        this.penalize(3);
        this.toast('Try again!');
        this.respawn();
      }
    }
    this.hurtFlash = 0.45;
    this.shake = 0.28;
  }

  private fall(): void {
    if (this.level?.id === 'hub') {
      this.player.x = 0;
      this.player.y = 0;
      this.player.z = 8;
      this.player.vx = this.player.vy = this.player.vz = 0;
      return;
    }
    this.penalize(2);
    this.toast('Back you go!');
    this.audio.sfx('hurt');
    this.respawn();
  }

  private respawn(): void {
    const p = this.player;
    p.x = this.checkpoint.x;
    p.y = this.checkpoint.y;
    p.z = this.checkpoint.z;
    p.vx = p.vy = p.vz = 0;
    p.iframe = 1.5;
    p.plunge = false;
    p.flutter = 0;
    this.exitMouth(true);
  }

  private penalize(n: number): void {
    const lost = Math.min(n, this.save.coins);
    this.save.coins -= lost;
    this.persist();
  }

  private nearestCar(): CarRt | null {
    const world = this.world;
    const p = this.player;
    if (!world) return null;
    let best: CarRt | null = null;
    let bestD = 2.3;
    for (const car of world.cars) {
      if (car.occupied) continue;
      const d = Math.hypot(car.x - p.x, car.z - p.z);
      if (d < bestD && Math.abs(car.y - p.y) < 1.4) {
        best = car;
        bestD = d;
      }
    }
    return best;
  }

  private nearestCone(): ConeRt | null {
    const world = this.world;
    const p = this.player;
    if (!world) return null;
    let best: ConeRt | null = null;
    let bestD = 1.7;
    for (const cone of world.cones) {
      if (cone.carried) continue;
      const d = Math.hypot(cone.x - p.x, cone.z - p.z);
      if (d < bestD && Math.abs(cone.y - p.y) < 1.4) {
        best = cone;
        bestD = d;
      }
    }
    return best;
  }

  private enterCar(car: CarRt): void {
    const p = this.player;
    car.occupied = true;
    car.solid.active = false;
    p.mouth = 'car';
    p.x = car.x;
    p.y = car.y;
    p.z = car.z;
    p.rot = car.rot;
    this.audio.sfx('honk');
  }

  private exitMouth(resetHome: boolean): void {
    const world = this.world;
    const p = this.player;
    p.mouth = 'none';
    if (!world) return;
    for (const cone of world.cones) {
      if (resetHome) {
        cone.x = cone.homeX;
        cone.y = cone.homeY;
        cone.z = cone.homeZ;
      } else if (cone.carried) {
        cone.x = p.x;
        cone.y = p.y;
        cone.z = p.z;
      }
      cone.carried = false;
      cone.mesh.scale.setScalar(1);
    }
    for (const car of world.cars) {
      if (resetHome) {
        car.x = car.homeX;
        car.y = car.homeY;
        car.z = car.homeZ;
        car.rot = car.homeRot;
      } else if (car.occupied) {
        car.x = p.x;
        car.y = p.y;
        car.z = p.z;
        car.rot = p.rot;
      }
      car.occupied = false;
      this.syncCarSolid(car);
    }
  }

  private syncCarSolid(car: CarRt): void {
    car.solid.active = !car.occupied;
    car.solid.minX = car.x - 1.15;
    car.solid.maxX = car.x + 1.15;
    car.solid.minZ = car.z - 1.15;
    car.solid.maxZ = car.z + 1.15;
    car.solid.minY = car.y;
    car.solid.maxY = car.y + 1.2;
  }

  private updateBoss(dt: number): void {
    const boss = this.boss;
    if (!boss) return;
    const p = this.player;
    const dist = Math.hypot(p.x - boss.x, p.z - boss.z);
    if (boss.state === 'dead') {
      boss.timer -= dt;
      boss.rig.root.rotation.z = Math.min(1.15, boss.rig.root.rotation.z + dt * 1.6);
      boss.rig.root.position.y = 0.15;
      if (boss.timer <= 0 && !boss.deadSent) {
        boss.deadSent = true;
        this.finish(true);
      }
      return;
    }
    boss.rig.root.rotation.z = 0;
    if (boss.state === 'intro') {
      boss.timer -= dt;
      if (boss.timer <= 0) {
        boss.state = 'chase';
        boss.timer = 3.2;
      }
    } else if (boss.state === 'chase') {
      this.moveBoss(boss.hp <= 3 ? 3.3 : 2.35, dt);
      boss.timer -= dt;
      boss.shootCd -= dt;
      if (boss.hp <= 3 && boss.shootCd <= 0) {
        this.bossVolley();
        boss.shootCd = 3.3;
      }
      if (dist < 3.15) {
        boss.state = 'telegraph';
        boss.timer = 0.48;
        this.audio.sfx('roar');
      } else if (boss.timer <= 0) {
        boss.state = boss.next === 'spin' ? 'spin' : 'poundTell';
        boss.timer = boss.state === 'spin' ? 2.25 : 0.62;
        boss.next = boss.next === 'spin' ? 'pound' : 'spin';
        if (boss.state === 'poundTell') this.toast('Jump!');
      }
    } else if (boss.state === 'telegraph') {
      boss.timer -= dt;
      boss.rig.head.rotation.x = Math.sin(this.time * 28) * 0.15;
      if (boss.timer <= 0) {
        boss.state = 'lunge';
        boss.timer = 0.38;
      }
    } else if (boss.state === 'lunge') {
      this.moveBoss(8.6, dt);
      boss.timer -= dt;
      if (boss.timer <= 0) {
        boss.state = 'chase';
        boss.timer = 2.1;
      }
    } else if (boss.state === 'spin') {
      boss.spin += dt * 9;
      boss.rig.shell.rotation.y = boss.spin;
      this.moveBoss(4.4, dt);
      boss.timer -= dt;
      if (boss.timer <= 0) {
        boss.state = 'chase';
        boss.timer = 2.3;
      }
    } else if (boss.state === 'poundTell') {
      boss.timer -= dt;
      boss.rig.root.position.y = Math.min(1.7, (0.62 - boss.timer) * 2.6);
      if (boss.timer <= 0) {
        boss.state = 'pound';
        boss.timer = 0.45;
        boss.rig.root.position.y = 0;
        this.startRing();
        this.audio.sfx('stomp');
      }
    } else if (boss.state === 'pound') {
      boss.timer -= dt;
      if (boss.timer <= 0) {
        boss.state = 'chase';
        boss.timer = 2.4;
      }
    } else if (boss.state === 'stun') {
      boss.timer -= dt;
      boss.rig.root.rotation.z = Math.sin(this.time * 18) * 0.08;
      if (boss.timer <= 0) {
        boss.state = 'chase';
        boss.timer = 2.2;
        boss.rig.root.rotation.z = 0;
      }
    }
    if (boss.ringLive && this.ring) {
      boss.ringR += dt * 10.5;
      this.ring.scale.setScalar(boss.ringR);
      this.ring.position.set(boss.x, 0.18, boss.z);
      const pd = Math.hypot(p.x - boss.x, p.z - boss.z);
      if (!boss.ringHit && p.grounded && Math.abs(pd - boss.ringR) < 0.75) {
        boss.ringHit = true;
        this.hurt();
      }
      if (boss.ringR > 14) {
        boss.ringLive = false;
        this.ring.visible = false;
      }
    }
    boss.rig.root.position.x = boss.x;
    boss.rig.root.position.z = boss.z;
    if (boss.state !== 'poundTell' && boss.state !== 'stun') boss.rig.root.position.y = 0;
  }

  private moveBoss(speed: number, dt: number): void {
    const boss = this.boss;
    if (!boss) return;
    const dx = this.player.x - boss.x;
    const dz = this.player.z - boss.z;
    const dist = Math.hypot(dx, dz) || 1;
    boss.x += (dx / dist) * speed * dt;
    boss.z += (dz / dist) * speed * dt;
    boss.x = clamp(boss.x, -8.4, 8.4);
    boss.z = clamp(boss.z, -7.4, 8.6);
    this.pushBoss();
    boss.rig.root.rotation.y = Math.atan2(dx, dz);
  }

  private pushBoss(): void {
    const boss = this.boss;
    const world = this.world;
    if (!boss || !world) return;
    for (const solid of world.solids) {
      if (solid.active === false) continue;
      if (boss.y >= solid.maxY - 0.05 || boss.y + boss.height <= solid.minY) continue;
      const cx = clamp(boss.x, solid.minX, solid.maxX);
      const cz = clamp(boss.z, solid.minZ, solid.maxZ);
      let dx = boss.x - cx;
      let dz = boss.z - cz;
      let d = Math.hypot(dx, dz);
      if (d < 0.0001) {
        dx = 1;
        dz = 0;
        d = 1;
      }
      if (d < boss.radius) {
        boss.x += (dx / d) * (boss.radius - d);
        boss.z += (dz / d) * (boss.radius - d);
      }
    }
  }

  private bossVolley(): void {
    const boss = this.boss;
    if (!boss) return;
    const ang = Math.atan2(this.player.x - boss.x, this.player.z - boss.z);
    for (const off of [-0.38, 0, 0.38]) {
      const a = ang + off;
      this.shoot(false, boss.x, 1.15, boss.z, Math.sin(a) * 6.4, 1.4, Math.cos(a) * 6.4);
    }
    this.audio.sfx('roar');
  }

  private startRing(): void {
    const boss = this.boss;
    if (!boss || !this.ring) return;
    boss.ringLive = true;
    boss.ringR = 1.3;
    boss.ringHit = false;
    this.ring.visible = true;
    this.ring.position.set(boss.x, 0.18, boss.z);
  }

  private hitBoss(fromFire: boolean): void {
    const boss = this.boss;
    if (!boss || boss.state === 'dead' || this.bossInvuln > 0) return;
    const spiky = boss.state === 'spin' || boss.state === 'pound';
    if (!fromFire && spiky) {
      this.hurt();
      return;
    }
    if (boss.state === 'stun' && fromFire) {
      /* still counts */
    }
    boss.hp -= 1;
    this.bossInvuln = 0.65;
    this.audio.sfx('stomp');
    this.burst(boss.x, 1.2, boss.z, C.gold, 8);
    this.shake = 0.22;
    if (boss.hp <= 0) {
      boss.state = 'dead';
      boss.timer = 1.7;
      this.toast('You did it!');
    } else {
      boss.state = 'stun';
      boss.timer = 1.2;
    }
  }

  private animate(dt: number): void {
    const p = this.player;
    const world = this.world;
    if (this.mode === 'title') {
      this.hero.root.visible = true;
      this.hero.root.position.set(-1.2, 0, 2.5);
      this.hero.root.scale.setScalar(1);
      this.hero.flower.visible = false;
      const dx = this.camera.position.x + 1.2;
      const dz = this.camera.position.z - 2.5;
      this.hero.root.rotation.y = Math.atan2(dx, dz);
      animateHero(this.hero, this.time, 0, false, false, true);
    } else {
      const blink = p.star > 0 ? Math.sin(this.time * 42) > -0.35 : p.iframe > 0 ? Math.sin(this.time * 30) > 0 : true;
      this.hero.root.visible = p.mouth === 'none' && blink;
      this.hero.root.position.set(p.x, p.y, p.z);
      this.hero.root.rotation.y = p.rot;
      const grown = p.form === 'small' ? 1 : 1.26;
      this.hero.root.scale.setScalar(grown);
      this.hero.flower.visible = p.form === 'fire';
      const speed = Math.hypot(p.vx, p.vz);
      const flutter = p.flutter > 0 && this.input.jumpHeld;
      animateHero(this.hero, this.time, speed, !p.grounded, flutter, false);
      if (p.spin > 0) this.hero.root.rotation.y += this.time * 18;
    }
    if (world?.luigi) {
      animateHero(world.luigi, this.time, 0, false, false, true);
      world.luigi.root.position.y = Math.abs(Math.sin(this.time * 2)) * 0.05;
    }
    this.parade.forEach((toad, i) => {
      const base = toad.userData.baseY ?? 0;
      toad.position.y = base + Math.abs(Math.sin(this.time * 2.2 + i)) * 0.12;
      toad.rotation.y = Math.sin(this.time * 0.7 + i) * 0.5;
    });
    if (world) {
      for (const enemy of world.enemies) {
        if (!enemy.alive) continue;
        enemy.mesh.position.set(enemy.x, enemy.y, enemy.z);
        animateWalker(enemy.rig, this.time, true);
      }
      for (const toad of world.toads) {
        if (toad.rising > 0) {
          toad.rising -= dt;
          toad.mesh.position.y = toad.y + (1.15 - toad.rising) * 2.2;
          toad.mesh.scale.setScalar(Math.max(0.2, toad.rising));
          if (toad.rising <= 0) toad.mesh.visible = false;
        }
        toad.head.rotation.y = Math.sin(this.time * 1.5) * 0.2;
      }
      for (const item of world.pickups) {
        if (item.got) continue;
        item.mesh.position.y = item.baseY + Math.sin(this.time * 3 + item.x) * 0.12;
        item.mesh.rotation.y = this.time * 1.6;
      }
      for (const cone of world.cones) {
        if (cone.carried) {
          cone.mesh.visible = true;
          cone.mesh.position.set(p.x, p.y, p.z);
          cone.mesh.rotation.y = p.rot;
          cone.mesh.scale.setScalar(1.45);
        } else {
          cone.mesh.visible = true;
          cone.mesh.position.set(cone.x, cone.y, cone.z);
          cone.mesh.rotation.y = 0;
          cone.mesh.scale.setScalar(1);
        }
      }
      for (const car of world.cars) {
        if (car.occupied) {
          car.x = p.x;
          car.y = p.y;
          car.z = p.z;
          car.rot = p.rot;
        }
        car.mesh.position.set(car.x, car.y, car.z);
        car.mesh.rotation.y = car.rot;
        car.mesh.visible = true;
      }
      if (world.coinMesh) {
        for (const coin of world.coins) {
          this.dummy.position.set(coin.x, (coin.got ? coin.baseY : coin.baseY + Math.sin(this.time * 3 + coin.index) * 0.12), coin.z);
          this.dummy.rotation.set(Math.PI / 2, this.time * 2.4 + coin.index, 0);
          this.dummy.scale.setScalar(coin.got ? 0.0001 : 0.36);
          this.dummy.updateMatrix();
          world.coinMesh.setMatrixAt(coin.index, this.dummy.matrix);
        }
        world.coinMesh.instanceMatrix.needsUpdate = true;
      }
      const cloth = world.goal?.mesh.getObjectByName('cloth');
      if (cloth) cloth.rotation.z = Math.sin(this.time * 4) * 0.2;
      for (const cp of world.checkpoints) cp.mesh.rotation.y = this.time * 0.8;
      if (world.water) {
        const mat = world.water.material as THREE.MeshLambertMaterial;
        if (mat.map) mat.map.offset.y = this.time * 0.05;
      }
      for (const portal of world.portals) {
        if (portal.bars) portal.bars.visible = this.save.rescued.length < portal.need && !this.save.bossCleared;
      }
    }
    if (this.boss) {
      this.boss.rig.footL.position.z = 0.2 + Math.sin(this.time * 8) * 0.08;
      this.boss.rig.footR.position.z = 0.2 - Math.sin(this.time * 8) * 0.08;
    }
    const starOn = this.player.star > 0 && this.mode !== 'title';
    this.starMesh.visible = starOn;
    if (starOn) {
      this.starMesh.position.set(p.x, p.y + 2.1, p.z);
      this.starMesh.rotation.y = this.time * 4;
    }
    const sucking = this.input.inhaleHeld && !this.suckLock && p.mouth === 'none' && (this.mode === 'level' || this.mode === 'hub');
    this.prompt(this.promptText(sucking));
    this.updateCamera(dt);
    this.syncHud();
  }

  private promptText(sucking: boolean): string {
    if (this.mode !== 'level' && this.mode !== 'hub') return '';
    if (this.player.mouth !== 'none') return 'ACTION hops out';
    if (this.nearestCar()) return 'ACTION to drive';
    if (this.nearestCone()) return 'ACTION for the cone';
    if (sucking) return 'Inhaling...';
    return '';
  }

  private prompt(text: string): void {
    this.promptEl.textContent = text;
    this.promptEl.classList.toggle('on', text.length > 0);
  }

  private updateCamera(dt: number): void {
    if (this.mode === 'title') {
      const a = this.time * 0.18;
      this.camTarget.set(Math.sin(a) * 14, 6.4, Math.cos(a) * 14);
      this.camera.position.lerp(this.camTarget, 1 - Math.exp(-1.4 * dt));
      this.camera.lookAt(0, 1.4, 0);
      return;
    }
    const level = this.level;
    const p = this.player;
    const yaw = level?.camYaw ?? 0.4;
    const dist = (level?.camDist ?? 10) + (p.mouth === 'car' ? 2.2 : 0);
    const height = level?.camHeight ?? 6;
    this.look.set(p.x, p.y + (p.form === 'small' ? 1.05 : 1.25), p.z);
    const spd = Math.hypot(p.vx, p.vz);
    if (spd > 0.4) {
      this.look.x += (p.vx / spd) * 1.3;
      this.look.z += (p.vz / spd) * 1.3;
    }
    this.camTarget.set(this.look.x + Math.sin(yaw) * dist, this.look.y + height, this.look.z + Math.cos(yaw) * dist);
    if (this.shake > 0) {
      this.camTarget.x += (Math.random() - 0.5) * this.shake;
      this.camTarget.y += (Math.random() - 0.5) * this.shake * 0.6;
      this.shake = Math.max(0, this.shake - dt * 1.8);
    }
    this.pullCamera();
    if (this.level?.boss) {
      this.camTarget.x = clamp(this.camTarget.x, -11, 11);
      this.camTarget.z = clamp(this.camTarget.z, -11, 11);
    }
    this.camera.position.lerp(this.camTarget, 1 - Math.exp(-6 * dt));
    this.camera.lookAt(this.look);
  }

  private pullCamera(): void {
    const solids = this.world?.solids;
    if (!solids) return;
    const dx = this.camTarget.x - this.look.x;
    const dy = this.camTarget.y - this.look.y;
    const dz = this.camTarget.z - this.look.z;
    let maxT = 1;
    for (const solid of solids) {
      const t = rayAabb(this.look.x, this.look.y, this.look.z, dx, dy, dz, solid);
      if (t !== null && t < maxT && t > 0.08) maxT = t;
    }
    if (maxT < 1) {
      const pull = Math.max(0.18, maxT - 0.06);
      this.camTarget.set(this.look.x + dx * pull, this.look.y + dy * pull, this.look.z + dz * pull);
    }
  }

  private showTitle(): void {
    this.disposeWorld();
    this.level = LEVELS.hub ?? null;
    if (!this.level) return;
    this.world = buildWorld(this.level, this.worldGroup, this.save);
    this.applyAtmosphere(this.level);
    this.player = this.freshPlayer();
    this.spawnParade();
    this.setMode('title');
    this.audio.setTune('title');
    this.bossWrap.hidden = true;
  }

  private onPlay(): void {
    this.audio.unlock();
    const hub = LEVELS.hub;
    if (!hub) return;
    this.player = this.freshPlayer();
    this.player.x = hub.start[0];
    this.player.y = hub.start[1];
    this.player.z = hub.start[2];
    this.setMode('hub');
    this.audio.setTune('hub');
    if (!this.save.seenIntro) {
      this.save.seenIntro = true;
      this.persist();
      this.toast('Run through a stone arch!');
    }
    if (this.save.rescued.length >= TUNE.bossNeed && !this.save.bossNote) {
      this.save.bossNote = true;
      this.persist();
      this.toast('The Turtle King gate is open!');
    }
  }

  private enterHub(): void {
    this.audio.unlock();
    const hub = LEVELS.hub;
    if (!hub) return;
    this.disposeWorld();
    this.level = hub;
    this.world = buildWorld(hub, this.worldGroup, this.save);
    this.applyAtmosphere(hub);
    this.player = this.freshPlayer();
    this.player.x = hub.start[0];
    this.player.y = hub.start[1];
    this.player.z = hub.start[2];
    this.spawnParade();
    this.setMode('hub');
    this.audio.setTune('hub');
    if (this.save.rescued.length >= TUNE.bossNeed && !this.save.bossNote) {
      this.save.bossNote = true;
      this.persist();
      this.toast('The Turtle King gate is open!');
    }
  }

  private enterLevel(id: string): void {
    const level = LEVELS[id];
    if (!level || level.id === 'hub') {
      this.enterHub();
      return;
    }
    this.disposeWorld();
    this.level = level;
    this.world = buildWorld(level, this.worldGroup, this.save);
    this.applyAtmosphere(level);
    const saved = this.save.checkpoint[id];
    const resume = saved && !this.save.cleared.includes(id) ? saved : null;
    this.player = this.freshPlayer();
    this.player.x = resume ? resume.x : level.start[0];
    this.player.y = resume ? resume.y : level.start[1];
    this.player.z = resume ? resume.z : level.start[2];
    this.checkpoint.set(this.player.x, this.player.y, this.player.z);
    this.levelTime = 0;
    this.runCoins = 0;
    for (const cp of this.world.checkpoints) {
      if (Math.hypot(cp.x - this.player.x, cp.z - this.player.z) < 1.3) cp.used = true;
    }
    if (level.boss) this.spawnBoss();
    this.spawnParade();
    this.setMode('level');
    this.audio.setTune(level.boss ? 'boss' : 'level');
    this.banner(level.boss ? 'Jump on his head!' : level.name);
    if (id === 'highway' && !this.save.highwayTip) {
      this.save.highwayTip = true;
      this.persist();
      this.toast('Jump, then jump again to flutter!');
    }
  }

  private spawnBoss(): void {
    const rig = makeBoss();
    this.worldGroup.add(rig.root);
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0xff6a3d,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.ring = new THREE.Mesh(Geo.ring, this.ringMat);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.visible = false;
    this.ring.userData.keepGeo = true;
    this.worldGroup.add(this.ring);
    this.boss = {
      x: 0, y: 0, z: -1, hp: TUNE.bossHp, maxHp: TUNE.bossHp, state: 'intro', timer: 2.1,
      next: 'spin', radius: 1.45, height: 1.45, rig, shootCd: 2, ringR: 1, ringLive: false,
      ringHit: false, spin: 0, deadSent: false,
    };
    rig.root.position.set(0, 0, -1);
  }

  private spawnParade(): void {
    this.parade = [];
    if (!this.level) return;
    if (this.level.id !== 'hub' && !this.level.boss) return;
    const tints = [C.red, C.blue, C.gold, C.green, C.purple, C.orange, C.pink, C.teal, 0x49c2d4];
    this.save.rescued.forEach((_id, i) => {
      const toad = makeToad(tints[i % tints.length] ?? C.red);
      if (this.level?.boss) {
        const x = -8 + (i % 5) * 3.5;
        const z = i < 5 ? -11.1 : 10.6;
        toad.root.position.set(x, 0, z);
      } else {
        const a = (i / Math.max(this.save.rescued.length, 1)) * Math.PI * 2;
        toad.root.position.set(Math.cos(a) * 4.4, 0, -1.6 + Math.sin(a) * 3.5);
      }
      toad.root.userData.baseY = 0;
      this.worldGroup.add(toad.root);
      this.parade.push(toad.root);
    });
  }

  private finish(bossWin: boolean): void {
    const level = this.level;
    if (this.mode !== 'level' || !level) return;
    if (bossWin || level.boss) this.save.bossCleared = true;
    else if (!this.save.cleared.includes(level.id)) this.save.cleared.push(level.id);
    this.save.checkpoint[level.id] = null;
    this.persist();
    this.audio.sfx('win');
    this.fillResults(bossWin || level.boss);
    this.setMode('results');
    this.confetti();
  }

  private fillResults(bossWin: boolean): void {
    const level = this.level;
    const title = must('results-title');
    const sub = must('results-sub');
    const coins = must('results-coins');
    const time = must('results-time');
    const row = must('results-toads');
    if (bossWin) {
      title.textContent = 'You did it!';
      sub.textContent = 'The Turtle King left the ruins.';
    } else {
      title.textContent = `${level?.name ?? 'Place'} clear!`;
      sub.textContent = 'Friends on this path';
    }
    row.innerHTML = '';
    const defs = level?.toads ?? [];
    if (!bossWin) {
      for (const toad of defs) {
        const dot = document.createElement('span');
        dot.className = this.save.rescued.includes(toad.id) ? 'mini-toad on' : 'mini-toad';
        row.appendChild(dot);
      }
    }
    coins.textContent = `Coins: ${this.save.coins}`;
    const secs = Math.floor(this.levelTime);
    time.textContent = `Time ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  }

  private pause(): void {
    if (this.mode !== 'hub' && this.mode !== 'level') return;
    this.pausedFrom = this.mode;
    this.townBtn.textContent = this.mode === 'hub' ? 'TITLE' : 'BACK TO TOWN';
    this.setMode('pause');
  }

  private resume(): void {
    if (this.mode !== 'pause') return;
    this.setMode(this.pausedFrom);
  }

  private toggleMute(): void {
    this.audio.unlock();
    this.save.mute = !this.save.mute;
    this.audio.setMuted(this.save.mute);
    this.persist();
    this.syncHud();
  }

  private toggleFull(): void {
    const root = document.documentElement;
    if (!document.fullscreenElement) {
      void root.requestFullscreen?.().catch(() => this.toast('Fullscreen is blocked'));
    } else {
      void document.exitFullscreen?.();
    }
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    this.app.dataset.mode = mode;
    this.titleEl.hidden = mode !== 'title';
    this.pauseEl.hidden = mode !== 'pause';
    this.resultsEl.hidden = mode !== 'results';
    this.syncHud();
  }

  private syncHud(): void {
    if (this.heartsEl.childElementCount !== TUNE.maxHp) {
      this.heartsEl.replaceChildren();
      for (let i = 0; i < TUNE.maxHp; i++) {
        const span = document.createElement('span');
        span.textContent = '♥';
        this.heartsEl.appendChild(span);
      }
    }
    [...this.heartsEl.children].forEach((el, i) => el.classList.toggle('on', i < this.player.hp));
    this.coinEl.textContent = String(this.save.coins);
    const n = this.save.rescued.length;
    this.friendEl.textContent = this.save.bossCleared || n >= TUNE.bossNeed ? String(n) : `${n}/${TUNE.bossNeed}`;
    let label = '';
    if (this.player.star > 0) label = 'STAR';
    else if (this.player.mouth === 'car') label = 'CAR';
    else if (this.player.mouth === 'cone') label = 'CONE';
    else if (this.player.form === 'fire') label = 'FIRE';
    else if (this.player.form === 'big') label = 'BIG';
    this.powerEl.hidden = label === '';
    this.powerEl.textContent = label;
    const muteLabel = this.save.mute ? 'SOUND' : 'MUTE';
    must('btn-mute').textContent = muteLabel;
    must('btn-pause-mute').textContent = muteLabel;
    const showBoss = !!this.boss && this.mode === 'level' && this.level?.boss === true;
    this.bossWrap.hidden = !showBoss;
    if (showBoss && this.boss) this.bossFill.style.width = `${Math.max(0, this.boss.hp / this.boss.maxHp) * 100}%`;
  }

  private applyAtmosphere(level: LevelDef): void {
    this.scene.background = new THREE.Color(level.sky);
    this.scene.fog = new THREE.Fog(level.fog, level.fogNear, level.fogFar);
    this.renderer.setClearColor(level.sky);
  }

  private disposeWorld(): void {
    if (this.world) {
      for (const geo of this.world.trashGeo) geo.dispose();
      for (const tex of this.world.trashTex) tex.dispose();
      for (const mat of this.world.trashMat) mat.dispose();
    }
    this.ringMat?.dispose();
    this.ringMat = null;
    this.ring = null;
    this.boss = null;
    this.worldGroup.clear();
    this.world = null;
    this.parade = [];
    for (const shot of this.shots) this.killShot(shot);
  }

  private makeShots(): void {
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(Geo.low, B(C.gold));
      mesh.visible = false;
      mesh.scale.setScalar(0.22);
      mesh.userData.keepGeo = true;
      this.scene.add(mesh);
      this.shots.push({ mesh, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, friendly: true, active: false });
    }
  }

  private burst(x: number, y: number, z: number, color: number, n: number): void {
    for (let i = 0; i < n; i++) {
      let spark = this.sparks.find((s) => s.life <= 0);
      if (!spark) {
        if (this.sparks.length > 64) return;
        const mesh = new THREE.Mesh(Geo.box, new THREE.MeshBasicMaterial({ color }));
        mesh.userData.keepGeo = true;
        this.scene.add(mesh);
        spark = { mesh, vx: 0, vy: 0, vz: 0, life: 0 };
        this.sparks.push(spark);
      }
      (spark.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      spark.life = 0.35 + Math.random() * 0.28;
      spark.mesh.visible = true;
      spark.mesh.position.set(x, y, z);
      spark.mesh.scale.setScalar(0.08 + Math.random() * 0.1);
      spark.vx = (Math.random() - 0.5) * 5;
      spark.vy = 1.5 + Math.random() * 3.5;
      spark.vz = (Math.random() - 0.5) * 5;
    }
  }

  private updateSparks(dt: number): void {
    for (const spark of this.sparks) {
      if (spark.life <= 0) continue;
      spark.life -= dt;
      spark.vy -= 9 * dt;
      spark.mesh.position.x += spark.vx * dt;
      spark.mesh.position.y += spark.vy * dt;
      spark.mesh.position.z += spark.vz * dt;
      if (spark.life <= 0) spark.mesh.visible = false;
    }
  }

  private confetti(): void {
    const p = this.player;
    const colors = [C.red, C.gold, C.green, C.blue, C.white, C.orange];
    for (let i = 0; i < 8; i++) this.burst(p.x, p.y + 1.4, p.z, colors[i % colors.length] ?? C.gold, 6);
  }

  private banner(text: string): void {
    this.bannerEl.textContent = text;
    this.bannerEl.classList.add('show');
    this.bannerTimer = 1.8;
  }

  private toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    this.toastTimer = 1.7;
  }

  private tickUi(dt: number): void {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerEl.classList.remove('show');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.remove('show');
    }
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.6);
    this.hurtEl.style.opacity = String(this.hurtFlash);
  }

  private radius(): number {
    if (this.player.mouth === 'car') return 1.05;
    if (this.player.mouth === 'cone') return 0.62;
    return TUNE.radius;
  }

  private bodyHeight(): number {
    if (this.player.mouth === 'car') return 1.2;
    if (this.player.mouth === 'cone') return 1.35;
    return this.player.form === 'small' ? TUNE.height : TUNE.bigHeight;
  }

  private persist(): void {
    writeSave(this.save);
  }

  private buzz(ms: number): void {
    if (this.save.mute) return;
    navigator.vibrate?.(ms);
  }

  private resize = (): void => {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.5));
    this.renderer.setSize(w, h, false);
  };

  private snapshot(): Record<string, unknown> {
    return {
      mode: this.mode,
      level: this.level?.id ?? null,
      x: this.player.x,
      y: this.player.y,
      z: this.player.z,
      hp: this.player.hp,
      form: this.player.form,
      mouth: this.player.mouth,
      coins: this.save.coins,
      rescued: [...this.save.rescued],
      cleared: [...this.save.cleared],
      boss: this.boss ? { hp: this.boss.hp, state: this.boss.state } : null,
      star: this.player.star,
    };
  }

  private debugUnlock(): void {
    for (const id of ['highway-1', 'highway-2', 'highway-3', 'mall-1', 'mall-2', 'mall-3', 'beach-1', 'beach-2', 'beach-3']) {
      if (!this.save.rescued.includes(id)) this.save.rescued.push(id);
    }
    this.persist();
  }
}

function must(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}
