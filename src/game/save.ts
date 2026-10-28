import { SAVE_KEY } from './tuning';

export interface SaveData {
  v: 1;
  coins: number;
  rescued: string[];
  cleared: string[];
  bossCleared: boolean;
  checkpoint: Record<string, { x: number; y: number; z: number } | null>;
  collected: string[];
  mute: boolean;
  seenIntro: boolean;
  bossNote: boolean;
  highwayTip: boolean;
}

export function emptySave(): SaveData {
  return {
    v: 1,
    coins: 0,
    rescued: [],
    cleared: [],
    bossCleared: false,
    checkpoint: {},
    collected: [],
    mute: false,
    seenIntro: false,
    bossNote: false,
    highwayTip: false,
  };
}

function isSave(value: unknown): value is SaveData {
  if (!value || typeof value !== 'object') return false;
  const v = value as SaveData;
  return v.v === 1 && Array.isArray(v.rescued) && Array.isArray(v.collected) && Array.isArray(v.cleared);
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return emptySave();
    const parsed: unknown = JSON.parse(raw);
    if (!isSave(parsed)) return emptySave();
    return { ...emptySave(), ...parsed, v: 1 };
  } catch {
    return emptySave();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* private mode or a full disk should not stop play */
  }
}
