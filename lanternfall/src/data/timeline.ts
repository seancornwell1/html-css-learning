import { ENEMY_KIND } from './enemies';

/** The night (GAME_DESIGN §6.2). */
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

export type TimelineEventType =
  /** A closed ring of `kind` around the player. */
  | 'encircle'
  /** `count` elites from the spawn ring. */
  | 'elite'
  /** A boss arrives. */
  | 'boss'
  /** A line of crows from `count` sides. */
  | 'crow_line'
  /** The Procession: a wall of `kind` marching across the screen. */
  | 'procession';

export interface TimelineEvent {
  at: number;
  type: TimelineEventType;
  kind: number;
  count: number;
}

const W = ENEMY_KIND.wisp;
const F = ENEMY_KIND.faceless_walker;
const K = ENEMY_KIND.hopping_kasa;
const B = ENEMY_KIND.bride_of_the_reservoir;
const D = ENEMY_KIND.drowned;
const C = ENEMY_KIND.carrion_crow;
const L = ENEMY_KIND.long_neck;
const M = ENEMY_KIND.lantern_mouth;

const mix = (...pairs: [number, number][]): { kind: number; weight: number }[] =>
  pairs.map(([kind, weight]) => ({ kind, weight }));

export const TIMELINE: readonly TimelineSegment[] = [
  { at: 0, budget: 5, minAlive: 24, kinds: mix([W, 3], [F, 1]) },
  { at: 60, budget: 8, minAlive: 50, kinds: mix([W, 3], [F, 2], [K, 1]) },
  { at: 120, budget: 11, minAlive: 80, kinds: mix([W, 2], [F, 2], [K, 2], [C, 2]) },
  { at: 180, budget: 14, minAlive: 110, kinds: mix([W, 2], [F, 3], [K, 2], [C, 2], [D, 1]) },
  {
    at: 240,
    budget: 18,
    minAlive: 150,
    kinds: mix([W, 3], [F, 3], [K, 2], [C, 2], [D, 2], [M, 1]),
  },
  {
    at: 300,
    budget: 22,
    minAlive: 190,
    kinds: mix([W, 3], [F, 3], [K, 3], [C, 2], [D, 2], [M, 2], [L, 1]),
  },
  {
    at: 360,
    budget: 28,
    minAlive: 240,
    kinds: mix([W, 4], [F, 3], [K, 3], [C, 3], [D, 2], [M, 2], [L, 2]),
  },
  {
    at: 420,
    budget: 34,
    minAlive: 300,
    kinds: mix([W, 4], [F, 4], [K, 3], [C, 3], [D, 3], [M, 3], [L, 3]),
  },
  {
    at: 480,
    budget: 42,
    minAlive: 370,
    kinds: mix([W, 4], [F, 4], [K, 4], [C, 3], [D, 3], [M, 4], [L, 4]),
  },
  {
    at: 540,
    budget: 52,
    minAlive: 440,
    kinds: mix([W, 5], [F, 4], [K, 4], [C, 3], [D, 3], [M, 4], [L, 4]),
  },
];

export const TIMELINE_EVENTS: readonly TimelineEvent[] = [
  // Counts are chosen so rings are a closed wall at DIRECTOR.encircleRadius.
  { at: 90, type: 'encircle', kind: W, count: 140 },
  { at: 150, type: 'elite', kind: B, count: 1 },
  { at: 165, type: 'crow_line', kind: C, count: 1 },
  { at: 210, type: 'crow_line', kind: C, count: 2 },
  { at: 210, type: 'elite', kind: B, count: 1 },
  { at: 270, type: 'elite', kind: B, count: 2 },
  { at: 330, type: 'elite', kind: B, count: 1 },
  { at: 270, type: 'encircle', kind: F, count: 100 },
  { at: 300, type: 'boss', kind: ENEMY_KIND.bone_colossus, count: 1 },
  { at: 360, type: 'procession', kind: F, count: 44 },
  { at: 390, type: 'crow_line', kind: C, count: 2 },
  { at: 420, type: 'elite', kind: B, count: 1 },
  { at: 480, type: 'elite', kind: B, count: 1 },
  { at: 480, type: 'encircle', kind: D, count: 70 },
  { at: 510, type: 'crow_line', kind: C, count: 3 },
  { at: 540, type: 'boss', kind: ENEMY_KIND.mother_of_lanterns, count: 1 },
  { at: 540, type: 'elite', kind: B, count: 2 },
];

export function segmentAt(seconds: number): TimelineSegment {
  let seg = TIMELINE[0] as TimelineSegment;
  for (const s of TIMELINE) if (s.at <= seconds) seg = s;
  return seg;
}
