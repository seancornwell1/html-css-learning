import { DIRECTOR } from '../data/director';
import { ENEMIES } from '../data/enemies';
import { TIMELINE_EVENTS, segmentAt } from '../data/timeline';
import { SPAWN_RADIUS, TICK_RATE } from './constants';
import type { Sim } from './sim';

/** Spawn director state (hashed by the sim). */
export interface DirectorState {
  budget: number;
  nextKind: number;
  nextGroup: number;
}

/** While a boss lives the director eases off so the fight reads. */
const BOSS_BUDGET = 0.35;
const BOSS_MIN_ALIVE = 0.5;

export function runDirector(sim: Sim, d: DirectorState): void {
  const seg = segmentAt(sim.time);
  const boss = sim.bossesAlive > 0;
  d.budget += seg.budget * sim.stats.curse * (boss ? BOSS_BUDGET : 1) * (1 / TICK_RATE);
  const minAlive = seg.minAlive * (boss ? BOSS_MIN_ALIVE : 1);
  let spawned = 0;
  while (spawned < DIRECTOR.maxSpawnsPerTick) {
    if (d.nextKind < 0) rollNextGroup(sim, d, seg.kinds);
    const def = ENEMIES[d.nextKind];
    if (!def) break;
    const cost = def.cost * d.nextGroup;
    const starving = sim.enemies.count < minAlive;
    if (!starving && d.budget < cost) break;
    if (!starving) d.budget -= cost;
    spawned += spawnGroup(sim, d.nextKind, d.nextGroup);
    d.nextKind = -1;
    if (sim.enemies.count >= sim.enemies.capacity) break;
  }
  for (const ev of TIMELINE_EVENTS) {
    if (Math.round(ev.at * TICK_RATE) !== sim.tick) continue;
    switch (ev.type) {
      case 'encircle':
        encircle(sim, ev.kind, ev.count);
        break;
      case 'elite':
        for (let i = 0; i < ev.count; i++) spawnGroup(sim, ev.kind, 1, true);
        sim.events.push({ type: 'elite', kind: ev.kind });
        break;
      case 'boss':
        spawnGroup(sim, ev.kind, 1, true);
        sim.events.push({ type: 'boss', kind: ev.kind });
        break;
      case 'crow_line':
        for (let side = 0; side < ev.count; side++) crowLine(sim, ev.kind, side, ev.count);
        break;
      case 'procession':
        procession(sim, ev.kind, ev.count);
        sim.events.push({ type: 'procession' });
        break;
    }
  }
}

function rollNextGroup(
  sim: Sim,
  d: DirectorState,
  kinds: readonly { kind: number; weight: number }[],
): void {
  let total = 0;
  for (const k of kinds) total += k.weight;
  let r = sim.spawnRng.float() * total;
  let kind = kinds[0]?.kind ?? 0;
  for (const k of kinds) {
    r -= k.weight;
    if (r < 0) {
      kind = k.kind;
      break;
    }
  }
  const def = ENEMIES[kind];
  d.nextKind = kind;
  d.nextGroup = def ? sim.spawnRng.int(def.group[0], def.group[1]) : 1;
}

/** Spawn a pack on the ring outside the view, often ahead of the player. */
export function spawnGroup(sim: Sim, kind: number, size: number, force = false): number {
  if (ENEMIES[kind]?.behaviour === 'flank') return flock(sim, kind, size);
  const p = sim.player;
  const rng = sim.spawnRng;
  const ahead = rng.chance(DIRECTOR.spawnAheadChance) && (p.vx !== 0 || p.vy !== 0);
  const angle = ahead
    ? Math.atan2(p.faceY, p.faceX) + rng.range(-Math.PI / 2, Math.PI / 2)
    : rng.range(0, Math.PI * 2);
  const cx = p.x + Math.cos(angle) * SPAWN_RADIUS;
  const cy = p.y + Math.sin(angle) * SPAWN_RADIUS;
  let n = 0;
  for (let i = 0; i < size; i++) {
    const x = cx + rng.range(-40, 40) + Math.cos(angle) * i * 6;
    const y = cy + rng.range(-40, 40) + Math.sin(angle) * i * 6;
    if (sim.spawnEnemy(kind, x, y, force) >= 0) n++;
  }
  return n;
}

function encircle(sim: Sim, kind: number, count: number): void {
  const p = sim.player;
  const r = DIRECTOR.encircleRadius;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    sim.spawnEnemy(kind, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
  }
  sim.events.push({ type: 'encircle', kind });
}

/** Crows: a line formation that flies straight across, aimed at where the player is heading. */
function flock(sim: Sim, kind: number, size: number, angle?: number): number {
  const p = sim.player;
  const rng = sim.spawnRng;
  const a = angle ?? rng.range(0, Math.PI * 2);
  const sx = p.x + Math.cos(a) * SPAWN_RADIUS;
  const sy = p.y + Math.sin(a) * SPAWN_RADIUS;
  // Aim at the player's position one second ahead.
  const tx = p.x + p.vx - sx;
  const ty = p.y + p.vy - sy;
  const tl = Math.hypot(tx, ty) || 1;
  const dirX = tx / tl;
  const dirY = ty / tl;
  let n = 0;
  for (let i = 0; i < size; i++) {
    const off = (i - (size - 1) / 2) * 26;
    const slot = sim.spawnEnemy(kind, sx - dirY * off, sy + dirX * off);
    if (slot < 0) continue;
    sim.enemies.dirX[slot] = dirX;
    sim.enemies.dirY[slot] = dirY;
    n++;
  }
  return n;
}

function crowLine(sim: Sim, kind: number, side: number, sides: number): void {
  const base = sim.spawnRng.range(0, Math.PI * 2);
  flock(sim, kind, 11, base + (side / sides) * Math.PI * 2);
}

/** The Procession: a wall that marches straight across the screen. */
function procession(sim: Sim, kind: number, count: number): void {
  const p = sim.player;
  const a = sim.spawnRng.range(0, Math.PI * 2);
  const dirX = -Math.cos(a);
  const dirY = -Math.sin(a);
  const cx = p.x + Math.cos(a) * SPAWN_RADIUS;
  const cy = p.y + Math.sin(a) * SPAWN_RADIUS;
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * 30;
    const slot = sim.spawnEnemy(kind, cx - dirY * off, cy + dirX * off, true);
    if (slot < 0) continue;
    sim.enemies.march[slot] = 1;
    sim.enemies.dirX[slot] = dirX;
    sim.enemies.dirY[slot] = dirY;
  }
}
