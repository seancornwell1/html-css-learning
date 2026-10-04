/** Weapon definitions (GAME_DESIGN §5.2). Index in WEAPONS = sim weapon id. */
export type WeaponBehaviour = 'sweep' | 'homing_projectile';

/** Effective weapon numbers at a level, before player stats apply. */
export interface WeaponStats {
  damage: number;
  /** Seconds between activations. */
  cooldown: number;
  /** Sweep radius or projectile radius, px. */
  area: number;
  /** Swings or projectiles per activation. */
  amount: number;
  /** Enemies a projectile can hit before vanishing. */
  pierce: number;
  /** px/s */
  speed: number;
  /** Projectile lifetime, seconds. */
  duration: number;
  /** Knockback impulse, px/s. */
  knockback: number;
  /** Sweep arc, radians. */
  arc: number;
}

export interface WeaponDef {
  id: string;
  name: string;
  description: string;
  behaviour: WeaponBehaviour;
  base: WeaponStats;
  /** Additive deltas for Lv 2..8 (index 0 = Lv 2). `area` is a fraction of base. */
  levels: readonly (Partial<WeaponStats> & { text: string })[];
}

export const MAX_WEAPON_LEVEL = 8;
export const WEAPON_SLOTS = 6;

export const WEAPONS: readonly WeaponDef[] = [
  {
    id: 'lantern_flail',
    name: 'Lantern Flail',
    description: 'A wide sweep in front of you.',
    behaviour: 'sweep',
    base: {
      damage: 11,
      cooldown: 1.15,
      area: 95,
      amount: 1,
      pierce: Infinity,
      speed: 0,
      duration: 0,
      knockback: 160,
      arc: (130 * Math.PI) / 180,
    },
    levels: [
      { amount: 1, text: 'Also sweeps behind you.' },
      { damage: 5, text: '+5 damage.' },
      { area: 0.15, text: '+15% area.' },
      { damage: 5, text: '+5 damage.' },
      { cooldown: -0.15, text: '−0.15 s cooldown.' },
      { damage: 6, area: 0.15, text: '+6 damage, +15% area.' },
      { damage: 10, text: '+10 damage.' },
    ],
  },
  {
    id: 'ofuda_volley',
    name: 'Ofuda Volley',
    description: 'Paper talismans seek the nearest enemy.',
    behaviour: 'homing_projectile',
    base: {
      damage: 9,
      cooldown: 1.0,
      area: 8,
      amount: 1,
      pierce: 1,
      speed: 330,
      duration: 1.6,
      knockback: 60,
      arc: 0,
    },
    levels: [
      { amount: 1, text: '+1 talisman.' },
      { damage: 4, text: '+4 damage.' },
      { amount: 1, text: '+1 talisman.' },
      { pierce: 1, text: 'Pierces +1 enemy.' },
      { amount: 1, text: '+1 talisman.' },
      { damage: 5, text: '+5 damage.' },
      { pierce: 1, cooldown: -0.15, text: 'Pierces +1, −0.15 s cooldown.' },
    ],
  },
];

export const WEAPON_ID = { lantern_flail: 0, ofuda_volley: 1 } as const;

/** Weapon numbers at `level` (1-based), before player stats. */
export function weaponStatsAt(def: WeaponDef, level: number): WeaponStats {
  const s = { ...def.base };
  let areaFrac = 0;
  for (let i = 0; i < level - 1; i++) {
    const d = def.levels[i];
    if (!d) break;
    s.damage += d.damage ?? 0;
    s.cooldown += d.cooldown ?? 0;
    areaFrac += d.area ?? 0;
    s.amount += d.amount ?? 0;
    s.pierce += d.pierce ?? 0;
    s.speed += d.speed ?? 0;
    s.duration += d.duration ?? 0;
    s.knockback += d.knockback ?? 0;
    s.arc += d.arc ?? 0;
  }
  s.area = def.base.area * (1 + areaFrac);
  return s;
}
