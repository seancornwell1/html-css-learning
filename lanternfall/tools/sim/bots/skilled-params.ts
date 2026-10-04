/**
 * Skilled bot policy parameters. "Skilled" is defined as the best policy
 * found in this family by `tools/sim/search-skilled.ts` (maximising survival
 * across characters, NOT targeting the difficulty bands). Re-run the search
 * when the game changes a lot; it rewrites DEFAULT_SKILLED below.
 */
export interface SkilledParams {
  /** Ticks between decisions (3 = 50 ms). */
  thinkEvery: number;
  /** Random hand jitter added to the heading. */
  jitter: number;
  /** Comfort radius around ordinary enemies without melee weapons, px. */
  fearNormal: number;
  /** With melee weapons: comfort radius = reach × this (0 = ignore reach). */
  meleeSpacing: number;
  /** Comfort radius around lungers, crows lines, elites and bosses, px. */
  heavyFear: number;
  heavyWeight: number;
  /** Loot only when the nearest enemy is beyond fear × this. */
  safeFactor: number;
  emberPull: number;
  /** Pull toward reliquaries at any range (0 = ignore them). */
  chestPull: number;
  /** Go for a reliquary only if the nearest enemy is beyond safe × this. */
  chestMinFrac: number;
  /** 1 = lookahead veto of headings into heavy threats. */
  veto: number;
  /** 1 = ordinary enemies count in the veto too. */
  vetoNormal: number;
  /** Circle-strafe angle off the flee direction, degrees (0 = none). */
  strafe: number;
  /** Weight of incoming shots in the kiting field. */
  shotFear: number;
  /** Most weapons to carry while planning evolutions. */
  focusWeapons: number;
}

export const DEFAULT_SKILLED: SkilledParams = {
  thinkEvery: 3,
  jitter: 0,
  fearNormal: 115,
  meleeSpacing: 0.85,
  heavyFear: 200,
  heavyWeight: 2,
  safeFactor: 0.65,
  emberPull: 0.9,
  chestPull: 1.5,
  chestMinFrac: 0.4,
  veto: 1,
  vetoNormal: 0,
  strafe: 0,
  shotFear: 1,
  focusWeapons: 3,
};

/** Search ranges: [min, max, integer?]. */
export const SKILLED_SPACE: Record<keyof SkilledParams, [number, number, boolean]> = {
  thinkEvery: [2, 6, true],
  jitter: [0, 0.2, false],
  fearNormal: [60, 160, false],
  meleeSpacing: [0, 1.2, false],
  heavyFear: [100, 280, false],
  heavyWeight: [0.5, 3, false],
  safeFactor: [0.3, 1.2, false],
  emberPull: [0.3, 1.8, false],
  chestPull: [0, 2.5, false],
  chestMinFrac: [0, 1, false],
  veto: [0, 1, true],
  vetoNormal: [0, 1, true],
  strafe: [0, 120, false],
  shotFear: [0, 2, false],
  focusWeapons: [2, 6, true],
};

/** Defaults, overridable as JSON in SKILLED_PARAMS (used by the search). */
export function skilledParams(): SkilledParams {
  const raw = typeof process !== 'undefined' ? process.env.SKILLED_PARAMS : undefined;
  if (!raw) return DEFAULT_SKILLED;
  return { ...DEFAULT_SKILLED, ...(JSON.parse(raw) as Partial<SkilledParams>) };
}
