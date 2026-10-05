import type { PlayerStats } from '../sim/stats';

/**
 * The Shrine (GAME_DESIGN §9.1): permanent ranks bought with coins between
 * runs. Small per rank; total power is capped by the rank counts so that a
 * fully upgraded skilled player still faces a real night (§10).
 */
export interface ShrineRank {
  id: string;
  name: string;
  /** Stat raised (run tools have no stat). */
  stat?: keyof PlayerStats;
  perRank: number;
  maxRank: number;
  /** Cost of rank r+1 = baseCost × (r + 1)². */
  baseCost: number;
  text: string;
}

export const SHRINE: readonly ShrineRank[] = [
  {
    id: 'might',
    name: 'Whetted Spirit',
    stat: 'might',
    perRank: 0.015,
    maxRank: 5,
    baseCost: 40,
    text: '+1.5% damage per rank.',
  },
  {
    id: 'armor',
    name: 'Lacquered Skin',
    stat: 'armor',
    perRank: 1,
    maxRank: 2,
    baseCost: 60,
    text: '+1 armor per rank.',
  },
  {
    id: 'max_hp',
    name: 'Full Belly',
    stat: 'maxHp',
    perRank: 4,
    maxRank: 5,
    baseCost: 40,
    text: '+4 max HP per rank.',
  },
  {
    id: 'regen',
    name: 'Spring Water',
    stat: 'regen',
    perRank: 0.03,
    maxRank: 5,
    baseCost: 50,
    text: '+0.03 HP per second per rank.',
  },
  {
    id: 'cooldown',
    name: 'Quiet Breath',
    stat: 'cooldown',
    perRank: -0.008,
    maxRank: 5,
    baseCost: 60,
    text: '−0.8% cooldown per rank.',
  },
  {
    id: 'area',
    name: 'Wide Light',
    stat: 'area',
    perRank: 0.015,
    maxRank: 5,
    baseCost: 40,
    text: '+1.5% area per rank.',
  },
  {
    id: 'duration',
    name: 'Long Wick',
    stat: 'duration',
    perRank: 0.015,
    maxRank: 5,
    baseCost: 30,
    text: '+1.5% duration per rank.',
  },
  {
    id: 'move_speed',
    name: 'Light Feet',
    stat: 'moveSpeed',
    perRank: 0.01,
    maxRank: 5,
    baseCost: 40,
    text: '+1% move speed per rank.',
  },
  {
    id: 'magnet',
    name: 'Ember Song',
    stat: 'magnet',
    perRank: 0.05,
    maxRank: 5,
    baseCost: 25,
    text: '+5% pickup radius per rank.',
  },
  {
    id: 'luck',
    name: 'Fox Charm',
    stat: 'luck',
    perRank: 0.025,
    maxRank: 5,
    baseCost: 40,
    text: '+2.5% luck per rank.',
  },
  {
    id: 'growth',
    name: 'Old Wisdom',
    stat: 'growth',
    perRank: 0.01,
    maxRank: 5,
    baseCost: 60,
    text: '+1% XP per rank.',
  },
  {
    id: 'greed',
    name: 'Offering Bowl',
    stat: 'greed',
    perRank: 0.1,
    maxRank: 5,
    baseCost: 20,
    text: '+10% coins per rank.',
  },
  {
    id: 'revival',
    name: 'Paper Ancestor',
    stat: 'revival',
    perRank: 1,
    maxRank: 1,
    baseCost: 500,
    text: 'Revive once per night.',
  },
  {
    id: 'reroll',
    name: 'Recast',
    perRank: 1,
    maxRank: 3,
    baseCost: 50,
    text: '+1 reroll of level-up cards per night.',
  },
  {
    id: 'skip',
    name: 'Patience',
    perRank: 1,
    maxRank: 3,
    baseCost: 30,
    text: '+1 skip of a level-up per night.',
  },
  {
    id: 'banish',
    name: 'Exile',
    perRank: 1,
    maxRank: 3,
    baseCost: 60,
    text: '+1 banish (remove a card for the night).',
  },
];

export type MetaRanks = Record<string, number>;

export function rankCost(def: ShrineRank, currentRank: number): number {
  return def.baseCost * (currentRank + 1) * (currentRank + 1);
}

/** Every rank bought (skilled + max meta band). */
export function maxRanks(): MetaRanks {
  return Object.fromEntries(SHRINE.map((d) => [d.id, d.maxRank]));
}

/** Coins earned at the end of a run, on top of coins picked up. */
export function runPayout(seconds: number, kills: number, won: boolean): number {
  return Math.floor(seconds / 12 + kills / 40 + (won ? 150 : 0));
}
