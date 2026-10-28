/// <reference types="vite/client" />

export interface GameDebug {
  enter(id: string): void;
  play(): void;
  state(): Record<string, unknown>;
  unlock(): void;
  give(form: 'big' | 'fire' | 'star'): void;
}

declare global {
  interface Window {
    __GAME?: GameDebug;
  }
}
