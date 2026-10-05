/**
 * Stone lanterns and power-ups (GAME_DESIGN §7.1, §7.2). Lanterns are
 * breakable props placed near the player; breaking one rolls a drop.
 */
export const STONE_LANTERN = {
  /** Seconds between lantern placements. */
  every: 45,
  /** First lantern appears at this time. */
  first: 20,
  /** Placed this far from the player (inside the view, never on top). */
  minDist: 260,
  maxDist: 420,
  /** At most this many standing at once. */
  maxStanding: 3,
} as const;

/** Drop weights when a stone lantern breaks. */
export const LANTERN_DROPS = {
  lantern_burst: 12,
  spirit_call: 18,
  frenzy: 12,
  onigiri: 26,
  coin: 32,
} as const;

export type LanternDrop = keyof typeof LANTERN_DROPS;

/** Coins in a pouch: [min, max] (stone lanterns); elites drop the max. */
export const COIN_POUCH = [3, 8] as const;

export const ONIGIRI_HEAL = 30;

/** Lantern Burst: kills non-elites in view; elites and bosses lose this share of max HP. */
export const LANTERN_BURST = { eliteMaxHpFrac: 0.3 } as const;

/** Frenzy: Festival Night. */
export const FRENZY = {
  seconds: 10,
  /** Weapon cooldowns tick this much faster (2 = −50% cooldown). */
  cooldownRate: 2,
  moveSpeed: 1.3,
  contactDamage: 0.5,
} as const;
