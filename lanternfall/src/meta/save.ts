/**
 * The only module allowed to touch localStorage (CLAUDE.md). Data is
 * versioned; older saves are migrated forward, never discarded. Storage can
 * be unavailable (private mode, blocked), so every access is guarded and the
 * game runs on defaults without it.
 */
const KEY = 'lanternfall.save';
export const SAVE_VERSION = 1;

export type EffectsQuality = 'off' | 'low' | 'high';

export interface Settings {
  reduceFlashing: boolean;
  /** 0..1 multiplier on screen shake. */
  shake: number;
  effects: EffectsQuality;
  /** Photosensitivity notice acknowledged. */
  noticeSeen: boolean;
}

export interface SaveData {
  version: number;
  settings: Settings;
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    settings: { reduceFlashing: false, shake: 1, effects: 'high', noticeSeen: false },
  };
}

/** Migrations from version N to N+1, applied in order. */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {};

export function migrate(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  let data = raw as Record<string, unknown>;
  let version = typeof data.version === 'number' ? data.version : 0;
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    data = step ? step(data) : data;
    version++;
  }
  const s = (data.settings ?? {}) as Partial<Settings>;
  const effects: EffectsQuality =
    s.effects === 'off' || s.effects === 'low' || s.effects === 'high' ? s.effects : 'high';
  return {
    version: SAVE_VERSION,
    settings: {
      reduceFlashing: s.reduceFlashing === true,
      shake: typeof s.shake === 'number' ? Math.min(1, Math.max(0, s.shake)) : 1,
      effects,
      noticeSeen: s.noticeSeen === true,
    },
  };
}

export function loadSave(): SaveData {
  try {
    const text = localStorage.getItem(KEY);
    return migrate(text ? JSON.parse(text) : null);
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable: settings last for this session only.
  }
}
