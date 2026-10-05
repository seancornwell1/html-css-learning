/**
 * Difficulty targets (GAME_DESIGN §10): survival to 10:00 with no meta
 * upgrades, per character. Enforced with `--gate bands` from M5 on.
 */
export const BANDS = {
  naive: [0, 0.05],
  average: [0.1, 0.25],
  skilled: [0.5, 0.7],
  /** Skilled bot with every Shrine rank bought (M8). */
  skilled_meta: [0.8, 0.9],
} as const;

/** M3 gate: no single weapon may deal more than this share of damage. */
export const MAX_WEAPON_SHARE = 0.6;
