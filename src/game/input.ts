export class Input {
  x = 0;
  y = 0;
  jumpPressed = false;
  jumpHeld = false;
  attackPressed = false;
  attackHeld = false;
  inhalePressed = false;
  inhaleHeld = false;
  pausePressed = false;
  mutePressed = false;

  private stickX = 0;
  private stickY = 0;
  private keyX = 0;
  private keyY = 0;
  private padX = 0;
  private padY = 0;
  private keys = new Set<string>();
  private stickId: number | null = null;
  private originX = 0;
  private originY = 0;
  private jumpIds = new Set<number>();
  private attackIds = new Set<number>();
  private inhaleIds = new Set<number>();
  private layer: HTMLElement;
  private stick: HTMLElement;
  private knob: HTMLElement;
  private prevPadJump = false;
  private prevPadAttack = false;
  private prevPadInhale = false;
  private prevPadPause = false;

  constructor() {
    this.layer = mustEl('pointer-layer');
    this.stick = mustEl('stick');
    this.knob = mustEl('knob');
    this.bindButtons();
    this.layer.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.releaseAll());
  }

  preUpdate(): void {
    this.pollPad();
    let x = this.stickX + this.keyX + this.padX;
    let y = this.stickY + this.keyY + this.padY;
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    if (m < 0.16) {
      x = 0;
      y = 0;
    }
    this.x = x;
    this.y = y;
    this.jumpHeld = this.jumpIds.size > 0 || this.keys.has('Space') || this.keys.has('KeyZ') || this.prevPadJump;
    this.attackHeld = this.attackIds.size > 0 || this.keys.has('KeyK') || this.keys.has('KeyJ') || this.prevPadAttack;
    this.inhaleHeld = this.inhaleIds.size > 0 || this.keys.has('KeyL') || this.keys.has('ShiftLeft') || this.prevPadInhale;
  }

  endFrame(): void {
    this.jumpPressed = false;
    this.attackPressed = false;
    this.inhalePressed = false;
    this.pausePressed = false;
    this.mutePressed = false;
  }

  private bindButtons(): void {
    this.holdButton('btn-jump', this.jumpIds, () => {
      this.jumpPressed = true;
    });
    this.holdButton('btn-attack', this.attackIds, () => {
      this.attackPressed = true;
    });
    this.holdButton('btn-inhale', this.inhaleIds, () => {
      this.inhalePressed = true;
    });
  }

  private holdButton(id: string, set: Set<number>, edge: () => void): void {
    const el = mustEl(id);
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      if (!set.has(e.pointerId)) edge();
      set.add(e.pointerId);
      el.classList.add('held');
    });
    const release = (e: PointerEvent) => {
      set.delete(e.pointerId);
      if (set.size === 0) el.classList.remove('held');
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
  }

  private onDown = (e: PointerEvent): void => {
    if (this.stickId !== null) return;
    if (e.clientX > window.innerWidth * 0.52) return;
    this.stickId = e.pointerId;
    this.originX = e.clientX;
    this.originY = e.clientY;
    this.layer.setPointerCapture(e.pointerId);
    this.stick.classList.add('floating');
    this.moveStick(e.clientX, e.clientY);
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.stickId) return;
    this.moveStick(e.clientX, e.clientY);
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.stickId) return;
    this.stickId = null;
    this.stickX = 0;
    this.stickY = 0;
    this.stick.classList.remove('floating');
    this.stick.style.left = '';
    this.stick.style.top = '';
    this.knob.style.left = '';
    this.knob.style.top = '';
  };

  private moveStick(cx: number, cy: number): void {
    const max = 48;
    let dx = cx - this.originX;
    let dy = this.originY - cy;
    const m = Math.hypot(dx, dy);
    if (m > max) {
      dx = (dx / m) * max;
      dy = (dy / m) * max;
    }
    this.stickX = dx / max;
    this.stickY = dy / max;
    this.stick.style.left = `${this.originX - 64}px`;
    this.stick.style.top = `${this.originY - 64}px`;
    this.knob.style.left = `${35 + dx}px`;
    this.knob.style.top = `${35 - dy}px`;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    this.keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.code === 'Space' || e.code === 'KeyZ') this.jumpPressed = true;
    if (e.code === 'KeyK' || e.code === 'KeyJ') this.attackPressed = true;
    if (e.code === 'KeyL' || e.code === 'ShiftLeft') this.inhalePressed = true;
    if (e.code === 'KeyP' || e.code === 'Escape') this.pausePressed = true;
    if (e.code === 'KeyM') this.mutePressed = true;
    this.syncKeys();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    this.syncKeys();
  };

  private syncKeys(): void {
    this.keyX = (this.keys.has('ArrowRight') || this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('ArrowLeft') || this.keys.has('KeyA') ? 1 : 0);
    this.keyY = (this.keys.has('ArrowUp') || this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('ArrowDown') || this.keys.has('KeyS') ? 1 : 0);
  }

  private pollPad(): void {
    const pads = navigator.getGamepads?.();
    if (!pads) return;
    let used = false;
    for (const pad of pads) {
      if (!pad) continue;
      used = true;
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      this.padX = Math.abs(ax) > 0.2 ? ax : 0;
      this.padY = Math.abs(ay) > 0.2 ? -ay : 0;
      const jump = !!pad.buttons[0]?.pressed;
      const attack = !!pad.buttons[1]?.pressed || !!pad.buttons[2]?.pressed;
      const inhale = !!pad.buttons[3]?.pressed || !!pad.buttons[5]?.pressed;
      const pause = !!pad.buttons[9]?.pressed;
      if (jump && !this.prevPadJump) this.jumpPressed = true;
      if (attack && !this.prevPadAttack) this.attackPressed = true;
      if (inhale && !this.prevPadInhale) this.inhalePressed = true;
      if (pause && !this.prevPadPause) this.pausePressed = true;
      this.prevPadJump = jump;
      this.prevPadAttack = attack;
      this.prevPadInhale = inhale;
      this.prevPadPause = pause;
      break;
    }
    if (!used) {
      this.padX = 0;
      this.padY = 0;
      this.prevPadJump = false;
      this.prevPadAttack = false;
      this.prevPadInhale = false;
    }
  }

  private releaseAll(): void {
    this.keys.clear();
    this.stickId = null;
    this.stickX = 0;
    this.stickY = 0;
    this.keyX = 0;
    this.keyY = 0;
    this.jumpIds.clear();
    this.attackIds.clear();
    this.inhaleIds.clear();
    this.stick.classList.remove('floating');
  }
}

function mustEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}
