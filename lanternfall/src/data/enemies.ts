/** Enemy definitions (GAME_DESIGN §6.1). Index in ENEMIES = sim `kind`. */
export type EnemyBehaviour = 'chase' | 'hop';

export interface EnemyDef {
  id: string;
  hp: number;
  /** px/s (for hoppers: speed while airborne). */
  speed: number;
  contactDamage: number;
  /** Collision radius, px. */
  radius: number;
  /** XP carried by the ember it drops. */
  xp: number;
  /** Spawn-director budget cost. */
  cost: number;
  /** Spawned in packs of this size range. */
  group: readonly [number, number];
  /** Knockback taken is multiplied by this (heavy enemies < 1). */
  knockback: number;
  /**
   * Seconds of player movement this enemy anticipates when chasing. Leading
   * enemies cut off a fleeing player instead of trailing behind.
   */
  lead: number;
  behaviour: EnemyBehaviour;
}

export const ENEMIES: readonly EnemyDef[] = [
  {
    id: 'wisp',
    hp: 6,
    speed: 85,
    contactDamage: 4,
    radius: 9,
    xp: 1,
    cost: 1,
    group: [6, 12],
    knockback: 1.2,
    lead: 0.5,
    behaviour: 'chase',
  },
  {
    id: 'faceless_walker',
    hp: 18,
    speed: 68,
    contactDamage: 8,
    radius: 13,
    xp: 2,
    cost: 2,
    group: [1, 3],
    knockback: 1,
    lead: 1,
    behaviour: 'chase',
  },
  {
    id: 'hopping_kasa',
    hp: 14,
    speed: 190,
    contactDamage: 6,
    radius: 11,
    xp: 2,
    cost: 2,
    group: [2, 4],
    knockback: 1,
    lead: 0.6,
    behaviour: 'hop',
  },
];

export const ENEMY_KIND = { wisp: 0, faceless_walker: 1, hopping_kasa: 2 } as const;

export const MAX_ENEMY_RADIUS = Math.max(...ENEMIES.map((e) => e.radius));

/** Hopping Kasa cycle: crouch (telegraph), hop, land. Seconds. */
export const HOP = { crouch: 0.35, air: 0.3, rest: 0.25 } as const;

/** Per-minute scaling (GAME_DESIGN §6.1). */
export function enemyHpScale(minutes: number): number {
  return 1 + 0.1 * minutes + 0.012 * minutes * minutes;
}

export function enemyDamageScale(minutes: number): number {
  return 1 + 0.05 * minutes;
}
