import { ENEMY_KIND } from './enemies';

/**
 * The night (GAME_DESIGN §6.2). M1 uses only the first three enemy types;
 * the full roster, elites and bosses arrive in M5.
 */
export interface TimelineSegment {
  /** Start, seconds. The segment lasts until the next one starts. */
  at: number;
  /** Spawn-director budget per second (enemy `cost` units). */
  budget: number;
  /** If fewer enemies than this are alive, spawn immediately. */
  minAlive: number;
  /** Weighted enemy kinds. */
  kinds: readonly { kind: number; weight: number }[];
}

export interface TimelineEvent {
  at: number;
  type: 'encircle' | 'elite';
  kind: number;
  count: number;
}

const W = ENEMY_KIND.wisp;
const F = ENEMY_KIND.faceless_walker;
const K = ENEMY_KIND.hopping_kasa;
const B = ENEMY_KIND.bride_of_the_reservoir;

export const TIMELINE: readonly TimelineSegment[] = [
  {
    at: 0,
    budget: 5.0,
    minAlive: 24,
    kinds: [
      { kind: W, weight: 3 },
      { kind: F, weight: 1 },
    ],
  },
  {
    at: 60,
    budget: 8.0,
    minAlive: 50,
    kinds: [
      { kind: W, weight: 3 },
      { kind: F, weight: 2 },
      { kind: K, weight: 1 },
    ],
  },
  {
    at: 120,
    budget: 11.0,
    minAlive: 80,
    kinds: [
      { kind: W, weight: 2 },
      { kind: F, weight: 2 },
      { kind: K, weight: 2 },
    ],
  },
  {
    at: 180,
    budget: 14.0,
    minAlive: 110,
    kinds: [
      { kind: W, weight: 2 },
      { kind: F, weight: 3 },
      { kind: K, weight: 2 },
    ],
  },
  {
    at: 240,
    budget: 18.0,
    minAlive: 150,
    kinds: [
      { kind: W, weight: 3 },
      { kind: F, weight: 3 },
      { kind: K, weight: 2 },
    ],
  },
  {
    at: 300,
    budget: 22.0,
    minAlive: 190,
    kinds: [
      { kind: W, weight: 3 },
      { kind: F, weight: 3 },
      { kind: K, weight: 3 },
    ],
  },
  {
    at: 360,
    budget: 28.0,
    minAlive: 240,
    kinds: [
      { kind: W, weight: 4 },
      { kind: F, weight: 3 },
      { kind: K, weight: 3 },
    ],
  },
  {
    at: 420,
    budget: 34.0,
    minAlive: 300,
    kinds: [
      { kind: W, weight: 4 },
      { kind: F, weight: 4 },
      { kind: K, weight: 3 },
    ],
  },
  {
    at: 480,
    budget: 42.0,
    minAlive: 370,
    kinds: [
      { kind: W, weight: 4 },
      { kind: F, weight: 4 },
      { kind: K, weight: 4 },
    ],
  },
  {
    at: 540,
    budget: 52.0,
    minAlive: 460,
    kinds: [
      { kind: W, weight: 5 },
      { kind: F, weight: 4 },
      { kind: K, weight: 4 },
    ],
  },
];

export const TIMELINE_EVENTS: readonly TimelineEvent[] = [
  // Counts are chosen so the ring is a closed wall at DIRECTOR.encircleRadius.
  { at: 90, type: 'encircle', kind: W, count: 140 },
  { at: 270, type: 'encircle', kind: F, count: 100 },
  { at: 480, type: 'encircle', kind: K, count: 120 },
  // Elites carry the Reliquaries that evolve weapons.
  { at: 150, type: 'elite', kind: B, count: 1 },
  { at: 270, type: 'elite', kind: B, count: 2 },
  { at: 360, type: 'elite', kind: B, count: 1 },
  { at: 420, type: 'elite', kind: B, count: 1 },
  { at: 480, type: 'elite', kind: B, count: 1 },
  { at: 540, type: 'elite', kind: B, count: 2 },
];

export function segmentAt(seconds: number): TimelineSegment {
  let seg = TIMELINE[0] as TimelineSegment;
  for (const s of TIMELINE) if (s.at <= seconds) seg = s;
  return seg;
}
