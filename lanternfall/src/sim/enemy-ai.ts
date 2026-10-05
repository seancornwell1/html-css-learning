import { BEHAVIOUR, ENEMIES, ENEMY_KIND, HOP, MAX_ENEMY_RADIUS } from '../data/enemies';
import { WEAPONS } from '../data/weapons';
import { DESPAWN_RADIUS, DT, SPAWN_RADIUS } from './constants';
import { HAZARD } from './hazard-pool';
import { MODE } from './projectile-pool';
import type { Sim } from './sim';
import { len2 } from './vec';

/** Knockback velocity kept per tick (exponential decay). */
const KNOCKBACK_DECAY = 0.86;
/** Separation looks at most this many grid candidates per enemy (dense blobs). */
const SEPARATION_CANDIDATES = 24;
/** How hard overlapping enemies push apart (fraction of overlap per tick). */
const SEPARATION = 0.35;
const separationScratch = new Int32Array(SEPARATION_CANDIDATES);
/** Parasol blocking radius as a multiple of its hit radius. */
const PARASOL_CANOPY = 1.8;

/** Behaviour states (EnemyPool.state). */
export const STATE = { move: 0, windup: 1, act: 2, recover: 3 } as const;

/** Mother of Lanterns patterns, cycled in order. */
const MOTHER_PATTERNS = ['volley', 'summon', 'charge', 'volley', 'charge'] as const;

export function moveEnemies(sim: Sim): void {
  const e = sim.enemies;
  const p = sim.player;
  const hopCycle = HOP.crouch + HOP.air + HOP.rest;
  // Separation uses last tick's grid (positions one tick stale; fine).
  sim.enemyGrid.build(e.slots, e.count, e.x, e.y);
  for (let i = e.count - 1; i >= 0; i--) {
    const s = e.slots[i] as number;
    const def = ENEMIES[e.kind[s] as number];
    if (!def) continue;
    if (def.behaviour === 'prop') {
      // Props stand still; ones left far behind are cleared away.
      if (
        !def.persistent &&
        len2(p.x - (e.x[s] as number), p.y - (e.y[s] as number)) > DESPAWN_RADIUS
      ) {
        e.remove(s);
      }
      continue;
    }
    const x0 = e.x[s] as number;
    const y0 = e.y[s] as number;
    let x = x0;
    let y = y0;
    let dx = p.x - x;
    let dy = p.y - y;
    const d = len2(dx, dy);
    const straight = def.behaviour === 'flank' || e.march[s] === 1;
    if (straight) {
      // Flyers and marchers cross once and leave.
      const travelled = (e.aux[s] as number) + def.speed * DT;
      e.aux[s] = travelled;
      if (travelled > (e.march[s] ? SPAWN_RADIUS * 2.4 : BEHAVIOUR.flankRange)) {
        e.remove(s);
        continue;
      }
    } else if (d > DESPAWN_RADIUS) {
      // Recycle stragglers onto the spawn ring ahead of the player.
      const a = Math.atan2(p.faceY, p.faceX) + sim.spawnRng.range(-1, 1);
      e.x[s] = p.x + Math.cos(a) * SPAWN_RADIUS;
      e.y[s] = p.y + Math.sin(a) * SPAWN_RADIUS;
      continue;
    }

    // Status effects.
    let speedMul = e.speedMul[s] as number;
    const freeze = e.freezeT[s] as number;
    if (freeze > 0) {
      e.freezeT[s] = freeze - DT;
      speedMul = 0;
    }
    const slowT = e.slowT[s] as number;
    if (slowT > 0) {
      e.slowT[s] = slowT - DT;
      speedMul *= 1 - (e.slowAmt[s] as number);
    }
    // Aim where the player is going: lead grows with distance, so close
    // enemies still home in directly.
    const lead = def.lead * Math.min(1, d / 400);
    dx += p.vx * lead;
    dy += p.vy * lead;
    const dl = len2(dx, dy);
    const ux = dl > 0.001 ? dx / dl : 0;
    const uy = dl > 0.001 ? dy / dl : 0;
    let speed = def.speed * speedMul;
    let mx = ux;
    let my = uy;

    if (straight) {
      mx = e.dirX[s] as number;
      my = e.dirY[s] as number;
    } else {
      switch (def.behaviour) {
        case 'hop': {
          const before = e.timer[s] as number;
          const t = (before + DT * (speedMul > 0 ? 1 : 0)) % hopCycle;
          e.timer[s] = t;
          if (before < HOP.rest && t >= HOP.rest) {
            // Crouch starts: lock heading (the telegraph).
            e.dirX[s] = ux;
            e.dirY[s] = uy;
          }
          mx = e.dirX[s] as number;
          my = e.dirY[s] as number;
          if (t < HOP.rest + HOP.crouch) speed = 0;
          break;
        }
        case 'lunge':
          [speed, mx, my] = lunge(sim, s, d, ux, uy, speed);
          break;
        case 'ranged':
          [speed, mx, my] = ranged(sim, s, d, ux, uy, speed, speedMul);
          break;
        case 'tank':
          tank(sim, s, speedMul);
          break;
        case 'colossus':
          speed = colossus(sim, s, speed, speedMul);
          break;
        case 'mother':
          [speed, mx, my] = mother(sim, s, ux, uy, speed, speedMul);
          break;
        case 'reaper':
          // Relentless: speeds up for as long as the night lasts.
          e.speedMul[s] = (e.speedMul[s] as number) + (BEHAVIOUR.reaper.accel / def.speed) * DT;
          break;
        default:
          break;
      }
    }

    x += mx * speed * DT;
    y += my * speed * DT;
    x += (e.kbx[s] as number) * DT;
    y += (e.kby[s] as number) * DT;
    e.kbx[s] = (e.kbx[s] as number) * KNOCKBACK_DECAY;
    e.kby[s] = (e.kby[s] as number) * KNOCKBACK_DECAY;

    // Push apart from overlapping neighbours.
    const n = sim.enemyGrid.query(x, y, def.radius + MAX_ENEMY_RADIUS, separationScratch);
    let checked = 0;
    for (let k = 0; k < n && checked < 8; k++) {
      const o = separationScratch[k] as number;
      if (o === s) continue;
      const od = ENEMIES[e.kind[o] as number];
      if (!od) continue;
      const ox = x - (e.x[o] as number);
      const oy = y - (e.y[o] as number);
      const min = def.radius + od.radius;
      const d2 = ox * ox + oy * oy;
      if (d2 >= min * min || d2 < 1e-9) continue;
      checked++;
      const dd = Math.sqrt(d2);
      // Heavier enemies (low knockback) shove lighter ones aside.
      const push = ((min - dd) / dd) * SEPARATION * Math.min(1, def.knockback * 2);
      x += ox * push;
      y += oy * push;
    }
    e.x[s] = x;
    e.y[s] = y;
    e.vx[s] = (x - x0) / DT;
    e.vy[s] = (y - y0) / DT;
  }
}

/** Long-Neck: chase, then wind up (stand, heading locked), lunge, recover. */
function lunge(
  sim: Sim,
  s: number,
  d: number,
  ux: number,
  uy: number,
  speed: number,
): [number, number, number] {
  const e = sim.enemies;
  const L = BEHAVIOUR.lunge;
  const state = e.state[s] as number;
  const t = (e.stateT[s] as number) - DT;
  e.stateT[s] = t;
  if (state === STATE.move) {
    if (d < L.trigger && speed > 0) {
      e.state[s] = STATE.windup;
      e.stateT[s] = L.windup;
      e.dirX[s] = ux;
      e.dirY[s] = uy;
    }
    return [speed, ux, uy];
  }
  if (state === STATE.windup) {
    if (t <= 0) {
      e.state[s] = STATE.act;
      e.stateT[s] = L.dash;
    }
    return [0, ux, uy];
  }
  if (state === STATE.act) {
    if (t <= 0) {
      e.state[s] = STATE.recover;
      e.stateT[s] = L.recover;
    }
    return [L.speed * (e.speedMul[s] as number), e.dirX[s] as number, e.dirY[s] as number];
  }
  if (t <= 0) e.state[s] = STATE.move;
  return [speed * 0.4, ux, uy];
}

/** Lantern Mouth: hold a ring of distance, wind up, spit an orb. */
function ranged(
  sim: Sim,
  s: number,
  d: number,
  ux: number,
  uy: number,
  speed: number,
  speedMul: number,
): [number, number, number] {
  const e = sim.enemies;
  const R = BEHAVIOUR.ranged;
  const timer = (e.aux[s] as number) + DT * (speedMul > 0 ? 1 : 0);
  e.aux[s] = timer;
  if (e.state[s] === STATE.windup) {
    const t = (e.stateT[s] as number) - DT;
    e.stateT[s] = t;
    if (t <= 0) {
      e.state[s] = STATE.move;
      const p = sim.player;
      const a = Math.atan2(p.y - (e.y[s] as number), p.x - (e.x[s] as number));
      sim.spawnEnemyShot(
        e.x[s] as number,
        e.y[s] as number,
        a,
        R.shotSpeed,
        R.shotRadius,
        R.shotDamage,
        R.shotLife,
      );
    }
    return [0, ux, uy];
  }
  if (timer >= R.every && d < R.far + 120) {
    e.aux[s] = 0;
    e.state[s] = STATE.windup;
    e.stateT[s] = R.windup;
    return [0, ux, uy];
  }
  if (d > R.far) return [speed, ux, uy];
  if (d < R.near) return [speed, -ux, -uy];
  // Drift sideways around the player.
  return [speed * 0.5, -uy, ux];
}

/** Drowned: leaves a slowing puddle every few seconds. */
function tank(sim: Sim, s: number, speedMul: number): void {
  const e = sim.enemies;
  const P = BEHAVIOUR.puddle;
  const timer = (e.aux[s] as number) + DT * (speedMul > 0 ? 1 : 0);
  if (timer < P.every) {
    e.aux[s] = timer;
    return;
  }
  e.aux[s] = 0;
  const h = sim.hazards.spawn(
    HAZARD.puddle,
    e.x[s] as number,
    e.y[s] as number,
    P.radius,
    0,
    P.life,
  );
  if (h >= 0) sim.hazards.slow[h] = P.slow;
}

/** Bone Colossus: periodically stops and slams the ground around it. */
function colossus(sim: Sim, s: number, speed: number, speedMul: number): number {
  const e = sim.enemies;
  const C = BEHAVIOUR.colossus;
  if (e.state[s] === STATE.windup) {
    const t = (e.stateT[s] as number) - DT;
    e.stateT[s] = t;
    if (t <= 0) e.state[s] = STATE.move;
    return 0;
  }
  const timer = (e.aux[s] as number) + DT * (speedMul > 0 ? 1 : 0);
  e.aux[s] = timer;
  if (timer >= C.every) {
    e.aux[s] = 0;
    e.state[s] = STATE.windup;
    e.stateT[s] = C.windup;
    const h = sim.hazards.spawn(
      HAZARD.slam,
      e.x[s] as number,
      e.y[s] as number,
      C.radius,
      C.windup,
      C.windup + 0.25,
    );
    if (h >= 0) sim.hazards.damage[h] = C.damage;
    return 0;
  }
  return speed;
}

/** Mother of Lanterns: volley, summon and charge in a fixed cycle. */
function mother(
  sim: Sim,
  s: number,
  ux: number,
  uy: number,
  speed: number,
  speedMul: number,
): [number, number, number] {
  const e = sim.enemies;
  const M = BEHAVIOUR.mother;
  // She snuffs out the light near her.
  const em = sim.embers;
  for (let i = em.count - 1; i >= 0; i--) {
    const k = em.slots[i] as number;
    const dx = (em.x[k] as number) - (e.x[s] as number);
    const dy = (em.y[k] as number) - (e.y[s] as number);
    if (dx * dx + dy * dy < M.snuff * M.snuff) em.remove(k);
  }
  const state = e.state[s] as number;
  if (state === STATE.windup) {
    const t = (e.stateT[s] as number) - DT;
    e.stateT[s] = t;
    if (t <= 0) {
      e.state[s] = STATE.act;
      e.stateT[s] = M.chargeTime;
    }
    return [0, ux, uy];
  }
  if (state === STATE.act) {
    const t = (e.stateT[s] as number) - DT;
    e.stateT[s] = t;
    if (t <= 0) e.state[s] = STATE.move;
    return [M.chargeSpeed, e.dirX[s] as number, e.dirY[s] as number];
  }
  const timer = (e.aux[s] as number) + DT * (speedMul > 0 ? 1 : 0);
  e.aux[s] = timer;
  if (timer < M.every) return [speed, ux, uy];
  e.aux[s] = 0;
  const pattern = MOTHER_PATTERNS[(e.timer[s] as number) % MOTHER_PATTERNS.length];
  e.timer[s] = (e.timer[s] as number) + 1;
  const x = e.x[s] as number;
  const y = e.y[s] as number;
  if (pattern === 'volley') {
    const offset = sim.spawnRng.range(0, Math.PI * 2);
    for (let i = 0; i < M.volley; i++) {
      const a = offset + (i / M.volley) * Math.PI * 2;
      sim.spawnEnemyShot(x, y, a, M.volleySpeed, 8, M.volleyDamage, 7);
    }
  } else if (pattern === 'summon') {
    for (let i = 0; i < M.summon; i++) {
      const a = (i / M.summon) * Math.PI * 2;
      sim.spawnEnemy(ENEMY_KIND.wisp, x + Math.cos(a) * 60, y + Math.sin(a) * 60, true);
    }
  } else {
    e.state[s] = STATE.windup;
    e.stateT[s] = M.chargeWindup;
    e.dirX[s] = ux;
    e.dirY[s] = uy;
  }
  return [0, ux, uy];
}

/** Move enemy shots; parasols block or reflect them; reflected shots hurt enemies. */
export function updateEnemyShots(sim: Sim): void {
  const sh = sim.enemyShots;
  const p = sim.player;
  const pr = sim.projectiles;
  for (let i = sh.count - 1; i >= 0; i--) {
    const s = sh.slots[i] as number;
    const life = (sh.life[s] as number) - DT;
    sh.life[s] = life;
    if (life <= 0) {
      sh.remove(s);
      continue;
    }
    const x = (sh.x[s] as number) + (sh.vx[s] as number) * DT;
    const y = (sh.y[s] as number) + (sh.vy[s] as number) * DT;
    sh.x[s] = x;
    sh.y[s] = y;
    const r = sh.radius[s] as number;
    const reflected = sh.reflected[s] as number;
    if (reflected > 0) {
      const weapon = reflected - 1;
      const n = sim.enemyGrid.query(x, y, r + MAX_ENEMY_RADIUS, sim.scratch);
      for (let k = 0; k < n; k++) {
        const es = sim.scratch[k] as number;
        if (!sim.enemies.isAlive(es)) continue;
        const ed = ENEMIES[sim.enemies.kind[es] as number];
        const dx = (sim.enemies.x[es] as number) - x;
        const dy = (sim.enemies.y[es] as number) - y;
        const rr = r + (ed?.radius ?? 10);
        if (dx * dx + dy * dy > rr * rr) continue;
        sim.damageEnemy(es, (sh.damage[s] as number) * 3, 0, 0, weapon);
        sh.remove(s);
        break;
      }
      continue;
    }
    // Parasol shields.
    let blocked = false;
    for (let k = 0; k < pr.count && !blocked; k++) {
      const ps = pr.slots[k] as number;
      if (pr.mode[ps] !== MODE.orbit) continue;
      const wdef = WEAPONS[pr.weapon[ps] as number];
      if (wdef?.behaviour !== 'parasol') continue;
      const dx = (pr.x[ps] as number) - x;
      const dy = (pr.y[ps] as number) - y;
      // The canopy is wider than its hitbox against enemies.
      const rr = r + (pr.radius[ps] as number) * PARASOL_CANOPY;
      if (dx * dx + dy * dy > rr * rr) continue;
      blocked = true;
      if (wdef.effects?.reflect) {
        sh.reflected[s] = (pr.weapon[ps] as number) + 1;
        sh.vx[s] = -(sh.vx[s] as number) * 1.4;
        sh.vy[s] = -(sh.vy[s] as number) * 1.4;
        sh.life[s] = 3;
      } else {
        sh.remove(s);
      }
    }
    if (blocked) continue;
    const dx = p.x - x;
    const dy = p.y - y;
    const rr = r + p.radius;
    if (dx * dx + dy * dy <= rr * rr && p.iframes <= 0) {
      sim.hurtPlayer(sh.damage[s] as number, 'shot');
      sh.remove(s);
    }
  }
}

/** Telegraphed slams and puddles. Sets `sim.playerSlow` for next tick. */
export function updateHazards(sim: Sim): void {
  const h = sim.hazards;
  const p = sim.player;
  let slow = 0;
  for (let i = h.count - 1; i >= 0; i--) {
    const s = h.slots[i] as number;
    const before = h.delay[s] as number;
    const delay = before - DT;
    h.delay[s] = delay;
    const dx = p.x - (h.x[s] as number);
    const dy = p.y - (h.y[s] as number);
    const r = (h.radius[s] as number) + p.radius * 0.5;
    const inside = dx * dx + dy * dy <= r * r;
    if (before > 0 && delay <= 0 && (h.damage[s] as number) > 0) {
      if (sim.events.enabled) {
        sim.events.push({
          type: 'slam',
          x: h.x[s] as number,
          y: h.y[s] as number,
          radius: h.radius[s] as number,
        });
      }
      if (inside) sim.hurtPlayer(h.damage[s] as number, 'slam');
    }
    if (delay <= 0 && inside) slow = Math.max(slow, h.slow[s] as number);
    const life = (h.life[s] as number) - DT;
    h.life[s] = life;
    if (life <= 0) h.remove(s);
  }
  sim.playerSlow = slow;
}
