import { ENEMIES } from '../../../src/data/enemies';
import { PASSIVES } from '../../../src/data/passives';
import { WEAPONS, weaponStatsAt } from '../../../src/data/weapons';
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
 * Card scoring shared by average and skilled bots: keep weapons growing,
 * fill slots early. With `planEvolutions`, prefer weapon/passive pairs that
 * evolve together (GAME_DESIGN §5.1), like a player who knows the recipes.
 */
export function priorityChoice(
  sim: Sim,
  options: readonly UpgradeOption[],
  planEvolutions = false,
): number {
  const ownedPassiveIds = new Set(sim.passives.map((p) => PASSIVES[p.passive]?.id));
  const pairedPassives = new Set(
    sim.weapons.map((w) => WEAPONS[w.weapon]?.evolvePassive).filter((x) => x !== undefined),
  );
  let best = 0;
  let bestScore = -Infinity;
  options.forEach((o, i) => {
    let score: number;
    switch (o.type) {
      case 'weapon_new': {
        const def = WEAPONS[o.weapon];
        score = sim.weapons.length < 3 ? 70 : 30;
        if (planEvolutions && def?.evolvePassive && ownedPassiveIds.has(def.evolvePassive))
          score += 25;
        break;
      }
      case 'weapon_level':
        score = 62 - o.toLevel * 2;
        if (planEvolutions) {
          const p = WEAPONS[o.weapon]?.evolvePassive;
          if (p && ownedPassiveIds.has(p)) score += 15;
        }
        break;
      case 'passive_new': {
        const id = PASSIVES[o.passive]?.id ?? '';
        score = 40;
        if (id === 'cracked_noh_mask') score = 5; // curse makes the night harder
        if (planEvolutions && pairedPassives.has(id)) score += 30;
        break;
      }
      case 'passive_level': {
        const id = PASSIVES[o.passive]?.id ?? '';
        score = 36 - o.toLevel * 2;
        if (id === 'cracked_noh_mask') score = planEvolutions && pairedPassives.has(id) ? 35 : 2;
        else if (planEvolutions && pairedPassives.has(id)) score += 22;
        break;
      }
      case 'heal':
        score = sim.player.hp < sim.stats.maxHp * 0.6 ? 45 : 1;
        break;
    }
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/** Nearest pickup slot within `range`, or -1. */
export function nearestPickup(sim: Sim, range: number): number {
  const p = sim.player;
  const pk = sim.pickups;
  let best = -1;
  let bestD2 = range * range;
  for (let i = 0; i < pk.count; i++) {
    const s = pk.slots[i] as number;
    const dx = (pk.x[s] as number) - p.x;
    const dy = (pk.y[s] as number) - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = s;
    }
  }
  return best;
}

/** Reach of the player's longest sweep weapon (0 if none). */
export function meleeReach(sim: Sim): number {
  let reach = 0;
  for (const w of sim.weapons) {
    const def = WEAPONS[w.weapon];
    if (def?.behaviour !== 'sweep' && def?.behaviour !== 'whip') continue;
    reach = Math.max(reach, weaponStatsAt(def, w.level).area * sim.stats.area);
  }
  return reach * 0.9;
}

/**
 * Where the light is: the single best loot target (embers by value over
 * distance, pickups weighted heavily). Summing directions would cancel out
 * when embers surround the player, so this picks one. Writes a unit vector
 * to `out`; returns the target's score (0 when nothing is in range).
 */
export function lootField(sim: Sim, range: number, out: { x: number; y: number }): number {
  const p = sim.player;
  let best = 0;
  let bx = 0;
  let by = 0;
  const consider = (x: number, y: number, value: number): void => {
    const dx = x - p.x;
    const dy = y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > range * range) return;
    const d = Math.sqrt(d2) || 1;
    const score = value / (d + 50);
    if (score > best) {
      best = score;
      bx = dx / d;
      by = dy / d;
    }
  };
  const em = sim.embers;
  for (let i = 0; i < em.count; i++) {
    const s = em.slots[i] as number;
    consider(em.x[s] as number, em.y[s] as number, em.value[s] as number);
  }
  const pk = sim.pickups;
  for (let i = 0; i < pk.count; i++) {
    const s = pk.slots[i] as number;
    consider(pk.x[s] as number, pk.y[s] as number, 60);
  }
  out.x = bx;
  out.y = by;
  return best > 0 ? 1 : 0;
}
