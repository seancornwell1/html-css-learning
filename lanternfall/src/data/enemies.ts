/** Enemy definitions (GAME_DESIGN §6.1). Index in ENEMIES = sim `kind`. */
export interface EnemyDef {
  id: string;
  hp: number;
  /** px/s */
  speed: number;
  contactDamage: number;
  /** Collision radius, px. */
  radius: number;
}

export const ENEMIES: readonly EnemyDef[] = [
  { id: 'wisp', hp: 6, speed: 70, contactDamage: 4, radius: 9 },
  { id: 'faceless_walker', hp: 18, speed: 55, contactDamage: 8, radius: 13 },
];

export const ENEMY_KIND = { wisp: 0, faceless_walker: 1 } as const;
