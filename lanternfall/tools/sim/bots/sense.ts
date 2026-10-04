import { ENEMIES } from '../../../src/data/enemies';
import { WEAPONS, WEAPON_ID, weaponStatsAt } from '../../../src/data/weapons';
import type { Sim } from '../../../src/sim/sim';
import type { UpgradeOption } from '../../../src/sim/upgrades';

/** Nearest live enemy slot within `range`, or -1. */
export function nearestEnemy(sim: Sim, range: number): number {
  const p = sim.player;
  const e = sim.enemies;
  const n = sim.enemyGrid.query(p.x, p.y, range, sim.scratch);
  let best = -1;
  let bestD2 = range * range;
  for (let k = 0; k < n; k++) {
    const s = sim.scratch[k] as number;
    if (!e.isAlive(s)) continue;
    const dx = (e.x[s] as number) - p.x;
    const dy = (e.y[s] as number) - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = s;
    }
  }
  return best;
}

/** Nearest ember slot within `range`, or -1. */
export function nearestEmber(sim: Sim, range: number): number {
  const p = sim.player;
  const em = sim.embers;
  let best = -1;
  let bestD2 = range * range;
  for (let i = 0; i < em.count; i++) {
    const s = em.slots[i] as number;
    const dx = (em.x[s] as number) - p.x;
    const dy = (em.y[s] as number) - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = s;
    }
  }
  return best;
}

/** Average move speed of an enemy kind, accounting for hopping pauses. */
export function effectiveSpeed(kind: number): number {
  const def = ENEMIES[kind];
  if (!def) return 0;
  return def.behaviour === 'hop' ? def.speed * 0.35 : def.speed;
}

/**
 * The "sensible player" upgrade order shared by average and skilled bots:
 * take a second weapon early, then keep the lowest-level weapon growing.
 */
export function priorityChoice(sim: Sim, options: readonly UpgradeOption[]): number {
  let best = 0;
  let bestScore = -Infinity;
  options.forEach((o, i) => {
    let score: number;
    if (o.type === 'weapon_new') score = o.weapon === WEAPON_ID.ofuda_volley ? 100 : 50;
    else if (o.type === 'weapon_level') score = 60 - o.toLevel * 5;
    else score = sim.player.hp < sim.stats.maxHp * 0.6 ? 40 : 1;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/** Reach of the player's longest sweep weapon (0 if none). */
export function meleeReach(sim: Sim): number {
  let reach = 0;
  for (const w of sim.weapons) {
    const def = WEAPONS[w.weapon];
    if (def?.behaviour !== 'sweep') continue;
    reach = Math.max(reach, weaponStatsAt(def, w.level).area * sim.stats.area);
  }
  return reach * 0.9;
}
