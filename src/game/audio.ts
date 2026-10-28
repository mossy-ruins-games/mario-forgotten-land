export type Tune = 'title' | 'hub' | 'level' | 'boss';
export type Sfx =
  | 'jump'
  | 'flutter'
  | 'coin'
  | 'stomp'
  | 'hurt'
  | 'shrink'
  | 'power'
  | 'fire'
  | 'kick'
  | 'win'
  | 'check'
  | 'boing'
  | 'honk'
  | 'roar'
  | 'break'
  | 'rescue'
  | 'click';

const SEMI: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

function midi(name: string): number {
  const m = /^([a-g])(\d)$/.exec(name);
  if (!m || !m[1] || !m[2]) return 440;
  const semi = SEMI[m[1]] ?? 0;
  const n = (Number(m[2]) + 1) * 12 + semi;
  return 440 * 2 ** ((n - 69) / 12);
}

const MELODY = [
  'g4', 'c5', 'e5', 'g5', 'a5', 'g5', 'e5', 'd5',
  'e5', 'g5', 'a5', 'g5', 'e5', 'd5', 'c5', 'd5',
  'f4', 'a4', 'c5', 'f5', 'e5', 'd5', 'c5', 'a4',
  'g4', 'c5', 'e5', 'd5', 'c5', 'd5', 'e5', 'c5',
];

const BASS = ['c3', 'g2', 'a2', 'f2', 'f2', 'c3', 'g2', 'c3', 'a2', 'e2', 'f2', 'c3', 'g2', 'e3', 'd3', 'c3'];

const BOSS = [
  'a3', 'c4', 'e4', 'a4', 'g4', 'e4', 'd4', 'c4',
  'e4', 'd4', 'c4', 'b3', 'a3', 'c4', 'e4', 'a4',
  'f4', 'e4', 'd4', 'c4', 'b3', 'd4', 'c4', 'a3',
  'e4', 'e4', 'd4', 'c4', 'b3', 'a3', 'c4', 'a3',
];

export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private inhaleGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private started = false;
  private tune: Tune = 'title';
  private queued: Tune = 'title';
  private step = 0;
  private next = 0;
  private muted = false;
  private coinWait = 0;

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.9;
  }

  unlock(): void {
    this.ensure();
    if (!this.ctx || !this.master || this.started) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.02);
    void this.ctx.resume();
    this.started = true;
    this.next = this.ctx.currentTime + 0.08;
    this.step = 0;
    this.tune = this.queued;
  }

  setTune(tune: Tune): void {
    this.queued = tune;
    if (!this.started || !this.ctx) return;
    if (this.tune === tune) return;
    this.tune = tune;
    this.step = 0;
    this.next = this.ctx.currentTime + 0.06;
  }

  setInhale(on: boolean): void {
    if (!this.ctx || !this.inhaleGain) return;
    this.inhaleGain.gain.setTargetAtTime(on && !this.muted ? 0.07 : 0.0001, this.ctx.currentTime, 0.04);
  }

  update(): void {
    if (!this.ctx || !this.started) return;
    if (this.coinWait > 0) this.coinWait = Math.max(0, this.coinWait - 0.016);
    if (this.next < this.ctx.currentTime - 0.4) this.next = this.ctx.currentTime;
    let guard = 0;
    while (this.next < this.ctx.currentTime + 0.22 && guard++ < 6) {
      this.schedule(this.step, this.next);
      const eighth = this.tune === 'boss' ? 0.16 : 0.24;
      this.next += eighth;
      const len = this.tune === 'boss' ? BOSS.length : MELODY.length;
      this.step = (this.step + 1) % len;
    }
  }

  sfx(name: Sfx): void {
    if (!this.ctx || !this.started || this.muted) return;
    switch (name) {
      case 'jump':
        this.tone(520, 0.12, 'square', 0.08, 280);
        break;
      case 'flutter':
        this.tone(740, 0.16, 'square', 0.06, 480);
        break;
      case 'coin':
        if (this.coinWait > 0) return;
        this.coinWait = 0.045;
        this.tone(880, 0.07, 'square', 0.07);
        this.tone(1320, 0.1, 'square', 0.05, undefined, 0.06);
        break;
      case 'stomp':
        this.tone(160, 0.12, 'sine', 0.12, 70);
        this.noise(0.08, 0.08, 500);
        break;
      case 'hurt':
        this.tone(240, 0.22, 'sawtooth', 0.07, 80);
        break;
      case 'shrink':
        this.tone(500, 0.18, 'square', 0.06, 180);
        break;
      case 'power':
        this.tone(523, 0.1, 'square', 0.07);
        this.tone(659, 0.1, 'square', 0.07, undefined, 0.09);
        this.tone(784, 0.16, 'square', 0.07, undefined, 0.18);
        break;
      case 'fire':
        this.noise(0.09, 0.07, 900);
        this.tone(320, 0.1, 'square', 0.05, 180);
        break;
      case 'kick':
        this.tone(210, 0.09, 'square', 0.07, 90);
        break;
      case 'win':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'square', 0.07, undefined, i * 0.12));
        break;
      case 'check':
        this.tone(660, 0.1, 'square', 0.07);
        this.tone(880, 0.16, 'square', 0.07, undefined, 0.1);
        break;
      case 'boing':
        this.tone(220, 0.16, 'sine', 0.1, 520);
        break;
      case 'honk':
        this.tone(180, 0.14, 'square', 0.08, 140);
        break;
      case 'roar':
        this.tone(110, 0.28, 'sawtooth', 0.06, 60);
        this.noise(0.18, 0.05, 300);
        break;
      case 'break':
        this.noise(0.14, 0.1, 700);
        this.tone(90, 0.12, 'sine', 0.08, 40);
        break;
      case 'rescue':
        this.tone(587, 0.1, 'triangle', 0.08);
        this.tone(784, 0.16, 'triangle', 0.08, undefined, 0.08);
        break;
      case 'click':
        this.tone(660, 0.05, 'square', 0.05);
        break;
      default:
        break;
    }
  }

  private ensure(): void {
    if (this.ctx) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.9;
    master.connect(ctx.destination);
    const music = ctx.createGain();
    music.gain.value = 0.55;
    music.connect(master);
    const sfx = ctx.createGain();
    sfx.gain.value = 0.8;
    sfx.connect(master);
    const inhale = ctx.createGain();
    inhale.gain.value = 0.0001;
    inhale.connect(sfx);
    const noise = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.7;
    src.connect(filter);
    filter.connect(inhale);
    src.start();
    this.ctx = ctx;
    this.master = master;
    this.musicGain = music;
    this.sfxGain = sfx;
    this.inhaleGain = inhale;
    this.noiseBuf = noise;
  }

  private schedule(step: number, time: number): void {
    const mel = this.tune === 'boss' ? BOSS : MELODY;
    const note = mel[step];
    if (note) this.toneAt(time, midi(note), this.tune === 'boss' ? 0.15 : 0.2, 'square', 0.055, 'music');
    if (step % 2 === 0) {
      const bass = BASS[Math.floor(step / 2) % BASS.length];
      if (bass) this.toneAt(time, midi(bass) * (this.tune === 'boss' ? 0.85 : 1), 0.26, 'triangle', 0.07, 'music');
    }
    if (step % 2 === 1) this.noiseAt(time, 0.03, 0.02, 2000);
    if (step % 4 === 0) this.toneAt(time, 130, 0.08, 'sine', 0.06, 'music', 48);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide?: number, delay = 0): void {
    if (!this.ctx) return;
    this.toneAt(this.ctx.currentTime + delay, freq, dur, type, vol, 'sfx', slide);
  }

  private toneAt(
    time: number,
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    bus: 'music' | 'sfx' = 'sfx',
    slide?: number,
  ): void {
    const dest = bus === 'music' ? this.musicGain : this.sfxGain;
    if (!this.ctx || !dest) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freq), time);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), time + dur);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(vol, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number): void {
    if (!this.ctx) return;
    this.noiseAt(this.ctx.currentTime, dur, vol, freq);
  }

  private noiseAt(time: number, dur: number, vol: number, freq: number): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(time);
    src.stop(time + dur + 0.02);
  }
}
