import type { PlayerStats } from '../sim/stats';

/** Characters (GAME_DESIGN §4). */
export type Innate =
  'lanternlight' | 'exorcism' | 'grave_hunger' | 'flutter' | 'no_face' | 'undertow';

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  startWeapon: string;
  innate: Innate;
  innateName: string;
  innateText: string;
  /** Additive changes to base stats. */
  mods: Partial<PlayerStats>;
  /** Max HP is fixed at this value whatever else applies (Kagerou). */
  fixedMaxHp?: number;
  /** Hidden until unlocked by a secret (M8). */
  secret?: boolean;
  /** Plain-language unlock hint (M8). */
  unlock: string;
}

export const CHARACTERS: readonly CharacterDef[] = [
  {
    id: 'akari',
    name: 'Akari',
    title: 'the Lamplighter',
    startWeapon: 'lantern_flail',
    innate: 'lanternlight',
    innateName: 'Lanternlight',
    innateText: 'Enemies inside your light take 10% more damage. The light grows every 10 levels.',
    mods: {},
    unlock: 'Available from the start.',
  },
  {
    id: 'ren',
    name: 'Ren',
    title: 'the Exorcist',
    startWeapon: 'ofuda_volley',
    innate: 'exorcism',
    innateName: 'Exorcism',
    innateText: 'Elites and bosses take 30% more damage. Their reliquaries hold one more gift.',
    mods: {},
    unlock: 'Available from the start.',
  },
  {
    id: 'tetsu',
    name: 'Tetsu',
    title: 'the Gravedigger',
    startWeapon: 'chain_sickle',
    innate: 'grave_hunger',
    innateName: 'Grave Hunger',
    innateText: 'Heal 1 HP for every 25 spirits laid to rest. Tough, but slow.',
    mods: { maxHp: 30, armor: 1, moveSpeed: -0.05 },
    unlock: 'Survive to 5:00 with anyone.',
  },
  {
    id: 'hotaru',
    name: 'Hotaru',
    title: 'the Moth Child',
    startWeapon: 'spirit_moths',
    innate: 'flutter',
    innateName: 'Flutter',
    innateText:
      'Dash a short way, untouchable while you do (Shift / Space, or the button). 6 s cooldown.',
    mods: { moveSpeed: 0.1, maxHp: -20 },
    unlock: 'Evolve any weapon once.',
  },
  {
    id: 'kagerou',
    name: 'Kagerou',
    title: 'the Faceless',
    startWeapon: 'mirror_shard',
    innate: 'no_face',
    innateName: 'No Face',
    innateText:
      'Enemies hit you 35% softer. Every 60 s the nearest elite loses sight of you. Max HP is always 75.',
    mods: { curse: 0.2 },
    fixedMaxHp: 75,
    secret: true,
    unlock: 'A secret. The faceless one follows those who never eat and never mend.',
  },
  {
    id: 'ido',
    name: 'Ido',
    title: 'the Well Keeper',
    startWeapon: 'koi_spirits',
    innate: 'undertow',
    innateName: 'Undertow',
    innateText:
      'Pickups drift to you from twice your magnet range. At 5:00 and 8:00 a flood hits every enemy for a fifth of its health.',
    mods: { moveSpeed: -0.15 },
    secret: true,
    unlock: 'A secret. The well keeper waits where no lantern was ever lit.',
  },
];

/** Light radius and damage bonus for Lanternlight (GAME_DESIGN §4). */
export const LANTERNLIGHT = { radius: 140, growthPer10Levels: 0.05, damage: 1.1 } as const;
export const EXORCISM = { damage: 1.3 } as const;
export const GRAVE_HUNGER = { killsPerHp: 25 } as const;
export const NO_FACE = {
  contactDamage: 0.65,
  blinkEvery: 60,
  blinkRange: 500,
  blinkSeconds: 3,
} as const;
export const UNDERTOW = {
  magnetMult: 2,
  driftSpeed: 70,
  floodAt: [300, 480],
  floodMaxHpFrac: 0.2,
} as const;
export const FLUTTER = { distance: 120, time: 0.15, iframes: 0.25, cooldown: 6 } as const;

export function characterDef(id: string): CharacterDef {
  const def = CHARACTERS.find((c) => c.id === id);
  if (!def) throw new Error(`unknown character ${id}`);
  return def;
}
