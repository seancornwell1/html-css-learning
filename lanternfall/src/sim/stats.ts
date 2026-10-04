/** Player stat block (GAME_DESIGN §3.2). Passives and meta modify it from M3/M8. */
export interface PlayerStats {
  /** Damage multiplier. */
  might: number;
  /** Size multiplier. */
  area: number;
  /** Duration multiplier. */
  duration: number;
  /** Extra projectiles/swings. */
  amount: number;
  /** Cooldown multiplier (lower is faster). */
  cooldown: number;
  projSpeed: number;
  /** Move speed multiplier. */
  moveSpeed: number;
  maxHp: number;
  /** Flat damage reduction per hit. */
  armor: number;
  /** HP per second. */
  regen: number;
  /** Pickup radius multiplier. */
  magnet: number;
  luck: number;
  /** XP multiplier. */
  growth: number;
  greed: number;
  curse: number;
  revival: number;
}

export function baseStats(maxHp: number): PlayerStats {
  return {
    might: 1,
    area: 1,
    duration: 1,
    amount: 0,
    cooldown: 1,
    projSpeed: 1,
    moveSpeed: 1,
    maxHp,
    armor: 0,
    regen: 0,
    magnet: 1,
    luck: 1,
    growth: 1,
    greed: 1,
    curse: 1,
    revival: 0,
  };
}

/** Minimum damage after armor. */
export const MIN_DAMAGE = 1;
/** Armor can never remove more than this share of a hit (GAME_DESIGN §3.2). */
export const ARMOR_CAP = 0.6;
