/**
 * The only module allowed to touch localStorage (CLAUDE.md). Data is
 * versioned; older saves are migrated forward, never discarded. Storage can
 * be unavailable (private mode, blocked), so every access is guarded and the
 * game runs on defaults without it.
 */
const KEY = 'lanternfall.save';
export const SAVE_VERSION = 3;

export type EffectsQuality = 'off' | 'low' | 'high';

export interface Settings {
  reduceFlashing: boolean;
  /** 0..1 multiplier on screen shake. */
  shake: number;
  effects: EffectsQuality;
  /** Photosensitivity notice acknowledged. */
  noticeSeen: boolean;
  /** 0..1 volumes. */
  volMaster: number;
  volMusic: number;
  volSfx: number;
}

export interface Profile {
  /** Character picked last time (preselected on the select screen). */
  lastCharacter: string;
  /** Shrine currency. */
  coins: number;
  /** Shrine ranks bought, by rank id (GAME_DESIGN §9.1). */
  ranks: Record<string, number>;
  /** Unlocked character ids (Akari and Ren start unlocked). */
  unlocked: string[];
  /** Evolved/union weapon ids ever obtained: the Lantern Register. */
  register: string[];
  /** Secrets discovered (ids). */
  secrets: string[];
  stats: { runs: number; wins: number; bestTime: number; kills: number };
}

export interface SaveData {
  version: number;
  settings: Settings;
  profile: Profile;
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    settings: {
      reduceFlashing: false,
      shake: 1,
      effects: 'high',
      noticeSeen: false,
      volMaster: 0.8,
      volMusic: 0.6,
      volSfx: 0.8,
    },
    profile: defaultProfile(),
  };
}

export function defaultProfile(): Profile {
  return {
    lastCharacter: 'akari',
    coins: 0,
    ranks: {},
    unlocked: ['akari', 'ren'],
    register: [],
    secrets: [],
    stats: { runs: 0, wins: 0, bestTime: 0, kills: 0 },
  };
}

type Raw = Record<string, unknown>;

/** Migrations from version N to N+1, applied in order. */
const MIGRATIONS: Record<number, (data: Raw) => Raw> = {
  // v1 → v2: profile added.
  1: (data) => ({ ...data, profile: { lastCharacter: 'akari' } }),
  // v2 → v3: meta progression (coins, ranks, unlocks, register, stats).
  2: (data) => ({
    ...data,
    profile: { ...defaultProfile(), ...((data.profile as object | undefined) ?? {}) },
  }),
};

export function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return defaultSave();
  let data = raw as Raw;
  let version = typeof data.version === 'number' ? data.version : 0;
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    data = step ? step(data) : data;
    version++;
  }
  const s = (data.settings ?? {}) as Partial<Settings>;
  const pr = (data.profile ?? {}) as Partial<Profile>;
  const effects: EffectsQuality =
    s.effects === 'off' || s.effects === 'low' || s.effects === 'high' ? s.effects : 'high';
  return {
    version: SAVE_VERSION,
    settings: {
      reduceFlashing: s.reduceFlashing === true,
      shake: unit(s.shake, 1),
      effects,
      noticeSeen: s.noticeSeen === true,
      // Volumes arrived within v3; absent fields take their defaults.
      volMaster: unit(s.volMaster, 0.8),
      volMusic: unit(s.volMusic, 0.6),
      volSfx: unit(s.volSfx, 0.8),
    },
    profile: sanitizeProfile(pr),
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

const unit = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

function sanitizeProfile(pr: Partial<Profile>): Profile {
  const d = defaultProfile();
  const ranks: Record<string, number> = {};
  for (const [k, v] of Object.entries(pr.ranks ?? {})) {
    if (typeof v === 'number' && v > 0) ranks[k] = Math.floor(v);
  }
  const unlocked = Array.from(new Set([...d.unlocked, ...strings(pr.unlocked)]));
  const st = (pr.stats ?? {}) as Partial<Profile['stats']>;
  return {
    lastCharacter: typeof pr.lastCharacter === 'string' ? pr.lastCharacter : d.lastCharacter,
    coins: Math.max(0, Math.floor(num(pr.coins))),
    ranks,
    unlocked,
    register: strings(pr.register),
    secrets: strings(pr.secrets),
    stats: {
      runs: num(st.runs),
      wins: num(st.wins),
      bestTime: num(st.bestTime),
      kills: num(st.kills),
    },
  };
}
