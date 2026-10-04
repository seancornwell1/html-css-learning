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
    innateText: 'Enemies inside your light take 12% more damage. The light grows every 10 levels.',
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
    mods: { maxHp: -10 },
    unlock: 'Available from the start.',
  },
  {
    id: 'tetsu',
    name: 'Tetsu',
    title: 'the Gravedigger',
    startWeapon: 'chain_sickle',
    innate: 'grave_hunger',
    innateName: 'Grave Hunger',
    innateText: 'Heal 1 HP for every 20 spirits laid to rest. Tough, but slow.',
    mods: { maxHp: 40, armor: 1, moveSpeed: -0.1 },
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
];

/** Light radius and damage bonus for Lanternlight (GAME_DESIGN §4). */
export const LANTERNLIGHT = { radius: 140, growthPer10Levels: 0.05, damage: 1.12 } as const;
export const EXORCISM = { damage: 1.3 } as const;
export const GRAVE_HUNGER = { killsPerHp: 20 } as const;
export const FLUTTER = { distance: 120, time: 0.15, iframes: 0.25, cooldown: 6 } as const;

export function characterDef(id: string): CharacterDef {
  const def = CHARACTERS.find((c) => c.id === id);
  if (!def) throw new Error(`unknown character ${id}`);
  return def;
}
