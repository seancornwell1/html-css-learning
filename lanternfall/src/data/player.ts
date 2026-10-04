/** Base player stats before character and passive modifiers (GAME_DESIGN §3.1). */
export const PLAYER_BASE = {
  maxHp: 100,
  /** px/s */
  moveSpeed: 150,
  radius: 12,
  pickupRadius: 48,
  /** Seconds of invulnerability after taking a hit. */
  iframes: 0.5,
} as const;
