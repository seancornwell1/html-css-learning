/** Enemy definitions (GAME_DESIGN §6.1). Index in ENEMIES = sim `kind`. */
export type EnemyBehaviour =
  | 'chase'
  | 'hop'
  /** Flies straight across the screen in formation, then leaves. */
  | 'flank'
  /** Chases, then telegraphs and lunges along a locked line. */
  | 'lunge'
  /** Keeps its distance and spits slow orbs. */
  | 'ranged'
  /** Slow chaser that leaves slowing puddles. */
  | 'tank'
  /** Miniboss: chases and telegraphs ground slams. */
  | 'colossus'
  /** Final boss: cycles volleys, summons and charges. */
  | 'mother'
  /** Long Night reaper: relentless and unkillable. */
  | 'reaper'
  /** Stone lantern: a breakable prop that drops a power-up (§7.2). */
  | 'prop';

export interface EnemyDef {
  id: string;
  name: string;
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
  /** Elites drop a Reliquary and resist knockback (GAME_DESIGN §6.1). */
  elite?: boolean;
  /** Bosses: fixed HP (no minute scaling), immune to execute, drop a Reliquary. */
  boss?: boolean;
  /** Cannot be damaged. */
  invulnerable?: boolean;
  /** Props only: never cleared for being far from the player. */
  persistent?: boolean;
}

export const ENEMIES: readonly EnemyDef[] = [
  {
    id: 'wisp',
    name: 'Wisp',
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
    name: 'Faceless Walker',
    hp: 18,
    speed: 68,
    contactDamage: 7,
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
    name: 'Hopping Kasa',
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
  {
    id: 'bride_of_the_reservoir',
    name: 'Bride of the Reservoir',
    hp: 900,
    speed: 60,
    contactDamage: 22,
    radius: 22,
    xp: 30,
    cost: 0,
    group: [1, 1],
    knockback: 0.15,
    lead: 0.8,
    behaviour: 'chase',
    elite: true,
  },
  {
    id: 'drowned',
    name: 'Drowned',
    hp: 70,
    speed: 38,
    contactDamage: 12,
    radius: 16,
    xp: 4,
    cost: 4,
    group: [1, 2],
    knockback: 0.45,
    lead: 0.3,
    behaviour: 'tank',
  },
  {
    id: 'carrion_crow',
    name: 'Carrion Crow',
    hp: 10,
    speed: 150,
    contactDamage: 6,
    radius: 9,
    xp: 1,
    cost: 1,
    group: [5, 9],
    knockback: 1,
    lead: 1,
    behaviour: 'flank',
  },
  {
    id: 'long_neck',
    name: 'Long-Neck',
    hp: 40,
    speed: 52,
    contactDamage: 20,
    radius: 13,
    xp: 3,
    cost: 3,
    group: [1, 2],
    knockback: 0.8,
    lead: 0.6,
    behaviour: 'lunge',
  },
  {
    id: 'lantern_mouth',
    name: 'Lantern Mouth',
    hp: 30,
    speed: 45,
    contactDamage: 6,
    radius: 12,
    xp: 3,
    cost: 3,
    group: [1, 3],
    knockback: 1,
    lead: 0,
    behaviour: 'ranged',
  },
  {
    id: 'bone_colossus',
    name: 'Bone Colossus',
    hp: 6000,
    speed: 45,
    contactDamage: 30,
    radius: 40,
    xp: 120,
    cost: 0,
    group: [1, 1],
    knockback: 0.02,
    lead: 0.5,
    behaviour: 'colossus',
    boss: true,
  },
  {
    id: 'mother_of_lanterns',
    name: 'Mother of Lanterns',
    hp: 25000,
    speed: 50,
    contactDamage: 35,
    radius: 34,
    xp: 400,
    cost: 0,
    group: [1, 1],
    knockback: 0.01,
    lead: 0.4,
    behaviour: 'mother',
    boss: true,
  },
  {
    id: 'lantern_eater',
    name: 'The Lantern-Eater',
    hp: 1,
    speed: 200,
    contactDamage: 9999,
    radius: 22,
    xp: 0,
    cost: 0,
    group: [1, 1],
    knockback: 0,
    lead: 0.5,
    behaviour: 'reaper',
    boss: true,
    invulnerable: true,
  },
  {
    id: 'stone_lantern',
    name: 'Stone Lantern',
    hp: 20,
    speed: 0,
    contactDamage: 0,
    radius: 12,
    xp: 0,
    cost: 0,
    group: [1, 1],
    knockback: 0,
    lead: 0,
    behaviour: 'prop',
  },
  {
    id: 'sealed_well',
    name: 'The Sealed Well',
    hp: 120,
    speed: 0,
    contactDamage: 0,
    radius: 18,
    xp: 0,
    cost: 0,
    group: [1, 1],
    knockback: 0,
    lead: 0,
    behaviour: 'prop',
    persistent: true,
  },
];

const kindOf = (id: string): number => ENEMIES.findIndex((e) => e.id === id);

export const ENEMY_KIND = {
  wisp: kindOf('wisp'),
  faceless_walker: kindOf('faceless_walker'),
  hopping_kasa: kindOf('hopping_kasa'),
  bride_of_the_reservoir: kindOf('bride_of_the_reservoir'),
  drowned: kindOf('drowned'),
  carrion_crow: kindOf('carrion_crow'),
  long_neck: kindOf('long_neck'),
  lantern_mouth: kindOf('lantern_mouth'),
  bone_colossus: kindOf('bone_colossus'),
  mother_of_lanterns: kindOf('mother_of_lanterns'),
  lantern_eater: kindOf('lantern_eater'),
  stone_lantern: kindOf('stone_lantern'),
  sealed_well: kindOf('sealed_well'),
} as const;

/** Largest enemy radius (grid queries pad by this). */
export const MAX_ENEMY_RADIUS = Math.max(...ENEMIES.map((e) => e.radius));

/** Hopping Kasa cycle: rest, crouch (telegraph), hop. Seconds. */
export const HOP = { crouch: 0.35, air: 0.3, rest: 0.25 } as const;

/** Behaviour tuning (GAME_DESIGN §6.1). */
export const BEHAVIOUR = {
  /** Crows leave once they have flown this far. */
  flankRange: 1500,
  lunge: { trigger: 170, windup: 0.6, dash: 0.35, speed: 420, recover: 1.2 },
  ranged: {
    near: 220,
    far: 320,
    every: 3,
    windup: 0.45,
    shotSpeed: 130,
    shotRadius: 7,
    shotDamage: 12,
    shotLife: 6,
  },
  puddle: { every: 2.2, radius: 34, life: 6, slow: 0.35 },
  colossus: { every: 6, windup: 1.1, radius: 150, damage: 40 },
  mother: {
    every: 4,
    volley: 18,
    volleySpeed: 125,
    volleyDamage: 16,
    summon: 8,
    chargeWindup: 0.8,
    chargeTime: 0.6,
    chargeSpeed: 380,
    /** She snuffs embers this close to her. */
    snuff: 120,
  },
  reaper: { accel: 12 },
} as const;

/** Per-minute HP scaling coefficients (GAME_DESIGN §6.1). */
export const HP_CURVE = { linear: 0.1, quadratic: 0.012 } as const;

/** Per-minute scaling (GAME_DESIGN §6.1). */
export function enemyHpScale(minutes: number): number {
  return 1 + HP_CURVE.linear * minutes + HP_CURVE.quadratic * minutes * minutes;
}

/** Later spirits carry more light (bigger embers), like their HP. */
export function enemyXpScale(minutes: number): number {
  return 1 + 0.3 * minutes;
}

export function enemyDamageScale(minutes: number): number {
  return 1 + 0.05 * minutes;
}
