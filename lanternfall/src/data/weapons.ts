/**
 * Weapon definitions (GAME_DESIGN §5.2). Index in WEAPONS = sim weapon id.
 * Evolved weapons are separate entries with `evolvedFrom`; they have no
 * levels and are only reachable through a Reliquary.
 */
export type WeaponBehaviour =
  | 'sweep' // sector around the facing direction
  | 'whip' // horizontal slashes to the sides
  | 'homing' // projectiles that steer toward a target
  | 'orbit' // projectiles circling the player
  | 'nova' // instant ring around the player
  | 'aura' // continuous damage field around the player
  | 'fan' // straight projectiles in the facing direction
  | 'zone_drop' // ground hazards dropped on enemies
  | 'boomerang' // out and back
  | 'strike' // instant hits on random visible enemies
  | 'parasol' // close spinning shield
  | 'ricochet' // bounces between enemies
  | 'beam' // instant line toward the densest direction
  | 'trail' // hazards left behind the player
  | 'wander' // slow-homing, long-lived piercing fish
  | 'turret'; // placed lanterns that shoot

/** Effective weapon numbers at a level, before player stats apply. */
export interface WeaponStats {
  damage: number;
  /** Seconds between activations (aura: between damage ticks). */
  cooldown: number;
  /** Radius / reach / length, px (scaled by the Area stat). */
  area: number;
  /** Projectiles, swings, zones, strikes or turrets per activation. */
  amount: number;
  /** Enemies a projectile can hit (ricochet: bounces). */
  pierce: number;
  /** px/s (orbit: radians/s). */
  speed: number;
  /** Seconds a projectile, zone or orbit lasts (scaled by Duration). */
  duration: number;
  /** Knockback impulse, px/s. */
  knockback: number;
  /** Sweep arc / fan spread, radians. */
  arc: number;
  /** Zone damage interval / orbit re-hit interval, seconds. */
  tick: number;
  /** Fraction of speed removed from enemies hit (0..1). */
  slow: number;
}

export interface WeaponEffects {
  /** Freeze enemies hit for this many seconds. */
  freeze?: number;
  /** Kill non-boss enemies left under this HP fraction. */
  execute?: number;
  /** HP healed per kill made by this weapon. */
  healPerKill?: number;
  /** Heal 1 HP every N hits. */
  lifestealEvery?: number;
  /** Sweep drops burning embers: zones per swing. */
  burnZones?: number;
  /** Zones chase the nearest enemy at this speed. */
  chase?: number;
  /** Orbit never expires. */
  permanent?: boolean;
  /** Extra projectiles per 60 px/s of current move speed. */
  speedScaling?: boolean;
  /** Extra random strikes from above per activation. */
  rain?: number;
  /** Strikes chain to this many more enemies. */
  chain?: number;
  /** Bounces pull nearby enemies toward the impact. */
  pull?: number;
  /** Kills add this much XP to the dropped ember. */
  xpBonus?: number;
  /** Chance a kill inside drops an Onigiri. */
  foodChance?: number;
  /** Armor granted while owned. */
  armor?: number;
  /** Reflects enemy projectiles instead of blocking them. */
  reflect?: boolean;
  /** Turret revives the player once per run. */
  revive?: boolean;
}

export interface WeaponDef {
  id: string;
  name: string;
  description: string;
  behaviour: WeaponBehaviour;
  base: WeaponStats;
  /** Additive deltas for Lv 2..8 (index 0 = Lv 2). `area` is a fraction of base. */
  levels: readonly (Partial<WeaponStats> & { text: string })[];
  effects?: WeaponEffects;
  /** Base weapons: passive id that, at max level, evolves it into `evolvesInto`. */
  evolvePassive?: string;
  evolvesInto?: string;
  /** Evolved weapons: the base weapon id. */
  evolvedFrom?: string;
  /** Union weapons: the two evolved weapon ids (GAME_DESIGN §5.4). */
  unionOf?: readonly [string, string];
  /** Union restricted to a character id. */
  unionCharacter?: string;
}

export const MAX_WEAPON_LEVEL = 8;
export const WEAPON_SLOTS = 6;

const DEG = Math.PI / 180;

function stats(s: Partial<WeaponStats>): WeaponStats {
  return {
    damage: 0,
    cooldown: 1,
    area: 0,
    amount: 1,
    pierce: 1,
    speed: 0,
    duration: 0,
    knockback: 0,
    arc: 0,
    tick: 0.5,
    slow: 0,
    ...s,
  };
}

const ARSENAL_I: readonly WeaponDef[] = [
  {
    id: 'lantern_flail',
    name: 'Lantern Flail',
    description: 'A wide sweep in front of you.',
    behaviour: 'sweep',
    base: stats({
      damage: 11,
      cooldown: 1.15,
      area: 95,
      knockback: 160,
      arc: 130 * DEG,
      pierce: Infinity,
    }),
    levels: [
      { amount: 1, text: 'Also sweeps behind you.' },
      { damage: 5, text: '+5 damage.' },
      { area: 0.15, text: '+15% area.' },
      { damage: 5, text: '+5 damage.' },
      { cooldown: -0.15, text: '−0.15 s cooldown.' },
      { damage: 6, area: 0.15, text: '+6 damage, +15% area.' },
      { damage: 10, text: '+10 damage.' },
    ],
    evolvePassive: 'iron_wick',
    evolvesInto: 'sunfall_censer',
  },
  {
    id: 'ofuda_volley',
    name: 'Ofuda Volley',
    description: 'Paper talismans seek the nearest enemy.',
    behaviour: 'homing',
    base: stats({ damage: 9, cooldown: 1.0, area: 8, speed: 330, duration: 1.6, knockback: 60 }),
    levels: [
      { amount: 1, text: '+1 talisman.' },
      { damage: 4, text: '+4 damage.' },
      { amount: 1, text: '+1 talisman.' },
      { pierce: 1, text: 'Pierces +1 enemy.' },
      { amount: 1, text: '+1 talisman.' },
      { damage: 5, text: '+5 damage.' },
      { pierce: 1, cooldown: -0.15, text: 'Pierces +1, −0.15 s cooldown.' },
    ],
    evolvePassive: 'ink_well',
    evolvesInto: 'thousand_seals',
  },
  {
    id: 'chain_sickle',
    name: 'Chain Sickle',
    description: 'A long slash to your side.',
    behaviour: 'whip',
    base: stats({ damage: 14, cooldown: 1.4, area: 160, knockback: 120, pierce: Infinity }),
    levels: [
      { amount: 1, text: 'Slashes both sides.' },
      { damage: 6, text: '+6 damage.' },
      { area: 0.15, text: '+15% reach.' },
      { damage: 6, text: '+6 damage.' },
      { cooldown: -0.15, text: '−0.15 s cooldown.' },
      { damage: 8, area: 0.1, text: '+8 damage, +10% reach.' },
      { damage: 10, text: '+10 damage.' },
    ],
    evolvePassive: 'whetstone',
    evolvesInto: 'harvest_moon',
  },
  {
    id: 'spirit_moths',
    name: 'Spirit Moths',
    description: 'Moths circle you for a while.',
    behaviour: 'orbit',
    base: stats({
      damage: 8,
      cooldown: 3,
      duration: 3,
      amount: 2,
      area: 70,
      speed: 3.2,
      tick: 0.4,
      knockback: 40,
      pierce: Infinity,
    }),
    levels: [
      { amount: 1, text: '+1 moth.' },
      { area: 0.15, text: '+15% orbit.' },
      { damage: 4, text: '+4 damage.' },
      { duration: 0.5, text: '+0.5 s duration.' },
      { amount: 1, text: '+1 moth.' },
      { damage: 5, text: '+5 damage.' },
      { amount: 1, speed: 0.6, text: '+1 moth, faster orbit.' },
    ],
    evolvePassive: 'burnt_incense',
    evolvesInto: 'moth_lords_veil',
  },
  {
    id: 'shrine_bell',
    name: 'Shrine Bell',
    description: 'A ringing shockwave that throws enemies back.',
    behaviour: 'nova',
    base: stats({ damage: 12, cooldown: 2.6, area: 110, knockback: 380, pierce: Infinity }),
    levels: [
      { damage: 5, text: '+5 damage.' },
      { area: 0.15, text: '+15% area.' },
      { cooldown: -0.3, text: '−0.3 s cooldown.' },
      { damage: 6, text: '+6 damage.' },
      { area: 0.15, text: '+15% area.' },
      { cooldown: -0.3, text: '−0.3 s cooldown.' },
      { damage: 10, text: '+10 damage.' },
    ],
    evolvePassive: 'prayer_beads',
    evolvesInto: 'bell_of_last_rites',
  },
  {
    id: 'salt_circle',
    name: 'Salt Circle',
    description: 'Burns and slows enemies near you.',
    behaviour: 'aura',
    base: stats({ damage: 4, cooldown: 0.6, area: 60, slow: 0.15, pierce: Infinity }),
    levels: [
      { area: 0.15, text: '+15% area.' },
      { damage: 2, text: '+2 damage.' },
      { slow: 0.05, text: 'Slows 5% more.' },
      { area: 0.15, text: '+15% area.' },
      { damage: 2, text: '+2 damage.' },
      { cooldown: -0.1, text: 'Burns faster.' },
      { area: 0.2, text: '+20% area.' },
    ],
    evolvePassive: 'pure_water',
    evolvesInto: 'tide_of_purification',
  },
  {
    id: 'kunai_fan',
    name: 'Kunai Fan',
    description: 'A fan of knives where you are heading.',
    behaviour: 'fan',
    base: stats({
      damage: 8,
      cooldown: 1.1,
      amount: 3,
      speed: 520,
      duration: 0.7,
      area: 6,
      arc: 0.18,
      knockback: 50,
    }),
    levels: [
      { amount: 1, text: '+1 knife.' },
      { damage: 3, text: '+3 damage.' },
      { pierce: 1, text: 'Pierces +1 enemy.' },
      { amount: 1, text: '+1 knife.' },
      { cooldown: -0.15, text: '−0.15 s cooldown.' },
      { damage: 4, text: '+4 damage.' },
      { amount: 2, text: '+2 knives.' },
    ],
    evolvePassive: 'straw_sandals',
    evolvesInto: 'ravens_rain',
  },
  {
    id: 'fox_fire',
    name: 'Fox Fire',
    description: 'Ghost flames burn the ground under enemies.',
    behaviour: 'zone_drop',
    base: stats({ damage: 4.5, cooldown: 3.2, amount: 2, area: 34, duration: 2.5, tick: 0.4 }),
    levels: [
      { amount: 1, text: '+1 flame.' },
      { area: 0.15, text: '+15% area.' },
      { damage: 3, text: '+3 damage.' },
      { duration: 0.5, text: '+0.5 s duration.' },
      { amount: 1, text: '+1 flame.' },
      { damage: 4, text: '+4 damage.' },
      { area: 0.2, amount: 1, text: '+20% area, +1 flame.' },
    ],
    evolvePassive: 'cracked_noh_mask',
    evolvesInto: 'nine_tailed_inferno',
  },
];

const EVOLVED_I: readonly WeaponDef[] = [
  {
    id: 'sunfall_censer',
    name: 'Sunfall Censer',
    description: 'A full circle of light that leaves burning embers.',
    behaviour: 'sweep',
    base: stats({
      damage: 42,
      cooldown: 0.95,
      area: 150,
      knockback: 220,
      arc: 2 * Math.PI,
      pierce: Infinity,
      duration: 2,
      tick: 0.4,
    }),
    levels: [],
    effects: { burnZones: 3 },
    evolvedFrom: 'lantern_flail',
  },
  {
    id: 'thousand_seals',
    name: 'Thousand Seals',
    description: 'A ceaseless stream of seals that freeze what they touch.',
    behaviour: 'homing',
    base: stats({
      damage: 22,
      cooldown: 0.16,
      area: 9,
      speed: 430,
      duration: 1.6,
      knockback: 40,
      pierce: 2,
    }),
    levels: [],
    effects: { freeze: 0.5 },
    evolvedFrom: 'ofuda_volley',
  },
  {
    id: 'harvest_moon',
    name: 'Harvest Moon',
    description: 'Crescent waves that cut through everything and feed you.',
    behaviour: 'fan',
    base: stats({
      damage: 45,
      cooldown: 1.1,
      amount: 2,
      speed: 380,
      duration: 1.2,
      area: 30,
      knockback: 150,
      pierce: Infinity,
      arc: Math.PI,
    }),
    levels: [],
    effects: { lifestealEvery: 12 },
    evolvedFrom: 'chain_sickle',
  },
  {
    id: 'moth_lords_veil',
    name: "Moth Lord's Veil",
    description: 'A swarm of moths that never leaves you.',
    behaviour: 'orbit',
    base: stats({
      damage: 18,
      cooldown: 1,
      duration: 1,
      amount: 6,
      area: 105,
      speed: 3.6,
      tick: 0.35,
      knockback: 60,
      pierce: Infinity,
    }),
    levels: [],
    effects: { permanent: true },
    evolvedFrom: 'spirit_moths',
  },
  {
    id: 'bell_of_last_rites',
    name: 'Bell of Last Rites',
    description: 'Each toll ends the weakest.',
    behaviour: 'nova',
    base: stats({ damage: 45, cooldown: 1.6, area: 170, knockback: 450, pierce: Infinity }),
    levels: [],
    effects: { execute: 0.1 },
    evolvedFrom: 'shrine_bell',
  },
  {
    id: 'tide_of_purification',
    name: 'Tide of Purification',
    description: 'A wide circle of salt water that mends you with every kill.',
    behaviour: 'aura',
    base: stats({ damage: 12, cooldown: 0.4, area: 115, slow: 0.3, pierce: Infinity }),
    levels: [],
    effects: { healPerKill: 0.5 },
    evolvedFrom: 'salt_circle',
  },
  {
    id: 'ravens_rain',
    name: "Raven's Rain",
    description: 'Knives that multiply with your speed, and more from above.',
    behaviour: 'fan',
    base: stats({
      damage: 20,
      cooldown: 0.5,
      amount: 6,
      speed: 560,
      duration: 0.75,
      area: 7,
      arc: 0.12,
      knockback: 60,
      pierce: 3,
    }),
    levels: [],
    effects: { speedScaling: true, rain: 4 },
    evolvedFrom: 'kunai_fan',
  },
  {
    id: 'nine_tailed_inferno',
    name: 'Nine-Tailed Inferno',
    description: 'Nine fires that hunt.',
    behaviour: 'zone_drop',
    base: stats({ damage: 14, cooldown: 3, amount: 9, area: 40, duration: 3.5, tick: 0.35 }),
    levels: [],
    effects: { chase: 120 },
    evolvedFrom: 'fox_fire',
  },
];

export const WEAPONS: readonly WeaponDef[] = [...ARSENAL_I, ...EVOLVED_I];

const INDEX = new Map(WEAPONS.map((w, i) => [w.id, i]));

/** Weapon index by id; throws on typos so data errors surface in tests. */
export function weaponIndex(id: string): number {
  const i = INDEX.get(id);
  if (i === undefined) throw new Error(`unknown weapon ${id}`);
  return i;
}

export const WEAPON_ID = {
  lantern_flail: weaponIndex('lantern_flail'),
  ofuda_volley: weaponIndex('ofuda_volley'),
} as const;

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
    s.tick += d.tick ?? 0;
    s.slow += d.slow ?? 0;
  }
  s.area = def.base.area * (1 + areaFrac);
  return s;
}

/** Max level of a weapon (evolved and union weapons have one level). */
export function maxLevel(def: WeaponDef): number {
  return def.levels.length + 1;
}
