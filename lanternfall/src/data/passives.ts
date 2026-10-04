import type { PlayerStats } from '../sim/stats';

/** Passive items (GAME_DESIGN §5.3). Index in PASSIVES = sim passive id. */
export interface PassiveDef {
  id: string;
  name: string;
  /** Stat it raises. */
  stat: keyof PlayerStats;
  /** Amount added at each level (index 0 = Lv 1). */
  perLevel: readonly number[];
  text: string;
}

export const PASSIVE_SLOTS = 6;

const five = (v: number): number[] => [v, v, v, v, v];

const ARSENAL_I: readonly PassiveDef[] = [
  {
    id: 'ink_well',
    name: 'Ink Well',
    stat: 'amount',
    perLevel: [1, 0, 1, 0, 1],
    text: '+1 projectile at Lv 1, 3 and 5.',
  },
  { id: 'iron_wick', name: 'Iron Wick', stat: 'area', perLevel: five(0.08), text: '+8% area.' },
  {
    id: 'burnt_incense',
    name: 'Burnt Incense',
    stat: 'duration',
    perLevel: five(0.08),
    text: '+8% duration.',
  },
  {
    id: 'pure_water',
    name: 'Pure Water',
    stat: 'regen',
    perLevel: five(0.2),
    text: '+0.2 HP per second.',
  },
  {
    id: 'straw_sandals',
    name: 'Straw Sandals',
    stat: 'moveSpeed',
    perLevel: five(0.08),
    text: '+8% move speed.',
  },
  { id: 'whetstone', name: 'Whetstone', stat: 'might', perLevel: five(0.08), text: '+8% damage.' },
  {
    id: 'prayer_beads',
    name: 'Prayer Beads',
    stat: 'cooldown',
    perLevel: five(-0.06),
    text: '−6% cooldown.',
  },
  {
    id: 'cracked_noh_mask',
    name: 'Cracked Noh Mask',
    stat: 'curse',
    perLevel: five(0.08),
    text: '+8% curse: tougher, faster, more numerous spirits that carry more light.',
  },
];

export const PASSIVES: readonly PassiveDef[] = [...ARSENAL_I];

const INDEX = new Map(PASSIVES.map((p, i) => [p.id, i]));

export function passiveIndex(id: string): number {
  const i = INDEX.get(id);
  if (i === undefined) throw new Error(`unknown passive ${id}`);
  return i;
}

export function passiveMaxLevel(def: PassiveDef): number {
  return def.perLevel.length;
}
