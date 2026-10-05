import { BEHAVIOUR, ENEMIES } from '../../../src/data/enemies';
import { STATE } from '../../../src/sim/enemy-ai';
import { HAZARD } from '../../../src/sim/hazard-pool';
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
    if (!e.isAlive(s) || isProp(e.kind[s] as number)) continue;
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

/** Nearest standing stone lantern within `range`, or -1. */
export function nearestProp(sim: Sim, range: number): number {
  const p = sim.player;
  const e = sim.enemies;
  let best = -1;
  let bestD2 = range * range;
  for (let i = 0; i < e.count; i++) {
    const s = e.slots[i] as number;
    if (!isProp(e.kind[s] as number)) continue;
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

/** Stone lanterns and other props: not threats (GAME_DESIGN §7.2). */
export function isProp(kind: number): boolean {
  return ENEMIES[kind]?.behaviour === 'prop';
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
  focusWeapons = 3,
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
        if (planEvolutions) {
          // Focus: a few weapons, each with its evolution partner.
          score = sim.weapons.length < focusWeapons ? 66 : 4;
          if (def?.evolvePassive && ownedPassiveIds.has(def.evolvePassive)) score += 25;
        } else {
          score = sim.weapons.length < 3 ? 70 : 30;
        }
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
        if (planEvolutions) {
          if (pairedPassives.has(id)) score += 30;
          else if (!GOOD_PASSIVES.has(id)) score = 8;
        }
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

/** Passives worth taking even without an evolution partner. */
const GOOD_PASSIVES = new Set([
  'whetstone',
  'prayer_beads',
  'ink_well',
  'iron_wick',
  'rice_ball',
  'lacquer_mask',
  'pure_water',
  'candle_stub',
]);

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

const predicted = { x: 0, y: 0 };

/**
 * Where enemy `slot` will be in `t` seconds if the player is at (px, py)
 * then. Chasers home in on the player (straight-line extrapolation would
 * call a sidestep safe when it is not); flyers keep their line; telegraphing
 * lungers/chargers dash along their locked heading.
 */
export function predictEnemy(
  sim: Sim,
  slot: number,
  t: number,
  px: number,
  py: number,
): { x: number; y: number } {
  const e = sim.enemies;
  const def = ENEMIES[e.kind[slot] as number];
  let x = e.x[slot] as number;
  let y = e.y[slot] as number;
  const state = e.state[slot] as number;
  const b = def?.behaviour;
  if ((b === 'lunge' || b === 'mother') && (state === STATE.windup || state === STATE.act)) {
    const lead = state === STATE.windup ? (e.stateT[slot] as number) : 0;
    const after = Math.max(0, t - lead);
    const speed = b === 'lunge' ? BEHAVIOUR.lunge.speed : BEHAVIOUR.mother.chargeSpeed;
    const dashT = b === 'lunge' ? BEHAVIOUR.lunge.dash : BEHAVIOUR.mother.chargeTime;
    const d = speed * Math.min(after, dashT);
    x += (e.dirX[slot] as number) * d;
    y += (e.dirY[slot] as number) * d;
  } else if (b === 'flank' || e.march[slot] === 1 || b === 'ranged') {
    x += (e.vx[slot] as number) * t;
    y += (e.vy[slot] as number) * t;
  } else {
    const tx = px - x;
    const ty = py - y;
    const td = Math.sqrt(tx * tx + ty * ty) || 1;
    const step = Math.min(
      td,
      effectiveSpeed(e.kind[slot] as number) * (e.speedMul[slot] as number) * t,
    );
    x += (tx / td) * step;
    y += (ty / td) * step;
  }
  predicted.x = x;
  predicted.y = y;
  return predicted;
}

/**
 * Hazard risk at (x, y) at time t from now: pending slams that will go off
 * by then and puddles. Shots are handled by `shotRisk`.
 */
export function hazardRisk(sim: Sim, x: number, y: number, t: number): number {
  const h = sim.hazards;
  let risk = 0;
  for (let i = 0; i < h.count; i++) {
    const s = h.slots[i] as number;
    const dx = x - (h.x[s] as number);
    const dy = y - (h.y[s] as number);
    const r = (h.radius[s] as number) + sim.player.radius + 6;
    if (dx * dx + dy * dy > r * r) continue;
    if (h.kind[s] === HAZARD.slam) {
      const delay = h.delay[s] as number;
      if (delay > 0 && delay <= t + 0.15) risk += 4;
    } else {
      risk += 0.3;
    }
  }
  return risk;
}

/** Shots that will be within reach of (x, y) at time t. */
export function shotRisk(sim: Sim, x: number, y: number, t: number): number {
  const sh = sim.enemyShots;
  let risk = 0;
  for (let i = 0; i < sh.count; i++) {
    const s = sh.slots[i] as number;
    if (sh.reflected[s]) continue;
    const qx = (sh.x[s] as number) + (sh.vx[s] as number) * t;
    const qy = (sh.y[s] as number) + (sh.vy[s] as number) * t;
    const r = (sh.radius[s] as number) + sim.player.radius + 4;
    const dx = x - qx;
    const dy = y - qy;
    if (dx * dx + dy * dy < r * r) risk += 2;
  }
  return risk;
}
