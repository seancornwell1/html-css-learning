import { ENEMIES } from '../../../src/data/enemies';
import type { Intent } from '../../../src/sim/intent';
import type { Sim } from '../../../src/sim/sim';
import { len2 } from '../../../src/sim/vec';
import type { Bot } from './bot';
import { effectiveSpeed, lootField, meleeReach, nearestPickup, priorityChoice } from './sense';

/** Reaction time: re-decides every 3 ticks (50 ms). */
const THINK_EVERY = 3;
const DIRECTIONS = 24;
const HORIZONS = [0.15, 0.35, 0.6] as const;
const SENSE_RADIUS = 260;
/** Comfort zone without melee weapons (as AverageBot). */
const FEAR_RADIUS = 115;
const STRAFE = (110 * Math.PI) / 180;

/**
 * Skilled (GAME_DESIGN §10). Deliberately "the average player, but better":
 * the same kite-and-loot instinct (see AverageBot), plus
 * - spacing tuned to its weapons: enemies are kept just inside melee reach
 *   (a cautious bot that kites beyond reach never lands a hit);
 * - circle-strafing: with threats close it moves ~110° off the flee
 *   direction, so facing-based weapons (flail, kunai) sweep the crowd
 *   instead of empty air behind a fleeing player;
 * - twice the reaction speed and no hand jitter;
 * - a lookahead that vetoes headings predicted to touch an enemy in the
 *   next 0.6 s, taking the closest safe heading instead;
 * - a stronger pull toward embers and reliquaries (loot field);
 * - evolution-aware upgrade picks.
 */
export class SkilledBot implements Bot {
  readonly name = 'skilled';
  private mx = 0;
  private my = 0;
  private readonly dirX = new Float64Array(DIRECTIONS);
  private readonly dirY = new Float64Array(DIRECTIONS);
  private readonly near = new Int32Array(512);
  private readonly loot = { x: 0, y: 0 };
  private strafe = 1;

  constructor(_seed: number) {
    for (let i = 0; i < DIRECTIONS; i++) {
      const a = (i / DIRECTIONS) * Math.PI * 2;
      this.dirX[i] = Math.cos(a);
      this.dirY[i] = Math.sin(a);
    }
  }

  decide(sim: Sim, out: Intent): Intent {
    if (sim.tick % THINK_EVERY === 0) this.think(sim);
    out.moveX = this.mx;
    out.moveY = this.my;
    out.action = false;
    return out;
  }

  private think(sim: Sim): void {
    const p = sim.player;
    const e = sim.enemies;
    const n = sim.enemyGrid.query(p.x, p.y, SENSE_RADIUS, this.near);
    const reach = meleeReach(sim);
    const fear = reach > 0 ? Math.max(55, reach * 0.85) : FEAR_RADIUS;
    const safe = fear * 0.65;

    // 1. Instinct: kite away from close threats, otherwise head for the light.
    let fx = 0;
    let fy = 0;
    let closest = Infinity;
    for (let k = 0; k < n; k++) {
      const s = this.near[k] as number;
      if (!e.isAlive(s)) continue;
      const def = ENEMIES[e.kind[s] as number];
      const ax = p.x - (e.x[s] as number);
      const ay = p.y - (e.y[s] as number);
      const len = len2(ax, ay) || 1;
      const d = len - (def?.radius ?? 10);
      closest = Math.min(closest, d);
      if (d >= fear) continue;
      const w = (1 - Math.max(d, 1) / fear) ** 2;
      fx += (ax / len) * w;
      fy += (ay / len) * w;
    }
    const threat = len2(fx, fy);
    if (threat > 0.02) {
      // Strafe: rotate the flee vector by ±110°, keeping the turn direction.
      const a = STRAFE * this.strafe;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const rx = fx * c - fy * sn;
      const ry = fx * sn + fy * c;
      fx = rx;
      fy = ry;
    }
    // Reliquaries are worth fighting for: go for one unless enemies are on top of us.
    const chest = nearestPickup(sim, 1e6);
    let tolerance = 0;
    if (chest >= 0 && closest > safe * 0.4) {
      // Worth a hit or two when healthy.
      if (p.hp > sim.stats.maxHp * 0.5) tolerance = 3;
      const dx = (sim.pickups.x[chest] as number) - p.x;
      const dy = (sim.pickups.y[chest] as number) - p.y;
      const d = len2(dx, dy) || 1;
      fx = fx * 0.5 + (dx / d) * 1.5;
      fy = fy * 0.5 + (dy / d) * 1.5;
    } else if (closest > safe) {
      const strength = lootField(sim, 450, this.loot);
      if (strength > 0) {
        const k = Math.min(1.4, 0.6 + strength);
        fx += this.loot.x * k;
        fy += this.loot.y * k;
      }
    }
    const fl = len2(fx, fy);
    let wantX = fl > 0.05 ? fx / fl : 0;
    let wantY = fl > 0.05 ? fy / fl : 0;

    // 2. Veto: if that heading touches an enemy soon, take the closest safe one.
    if (this.contactRisk(sim, n, wantX, wantY) > tolerance) {
      let best = Infinity;
      // Blocked: try strafing the other way next time.
      this.strafe = -this.strafe;
      for (let i = 0; i < DIRECTIONS; i++) {
        const dx = this.dirX[i] as number;
        const dy = this.dirY[i] as number;
        const risk = this.contactRisk(sim, n, dx, dy);
        // Prefer low risk, then closeness to the instinct, then momentum.
        const cost =
          risk * 1000 + (1 - (dx * wantX + dy * wantY)) * 10 - (dx * this.mx + dy * this.my);
        if (cost < best) {
          best = cost;
          wantX = dx;
          wantY = dy;
        }
      }
    }
    this.mx = wantX;
    this.my = wantY;
  }

  /** Weighted count of predicted contacts along heading (dx, dy). */
  private contactRisk(sim: Sim, n: number, dx: number, dy: number): number {
    const p = sim.player;
    const e = sim.enemies;
    const speed = sim.moveSpeed;
    let risk = 0;
    for (let h = 0; h < HORIZONS.length; h++) {
      const t = HORIZONS[h] as number;
      const px = p.x + dx * speed * t;
      const py = p.y + dy * speed * t;
      for (let k = 0; k < n; k++) {
        const s = this.near[k] as number;
        if (!e.isAlive(s)) continue;
        const kind = e.kind[s] as number;
        const def = ENEMIES[kind];
        if (!def) continue;
        let qx = e.x[s] as number;
        let qy = e.y[s] as number;
        const tx = px - qx;
        const ty = py - qy;
        const td = len2(tx, ty) || 1;
        const step = Math.min(td, effectiveSpeed(kind) * t);
        qx += (tx / td) * step;
        qy += (ty / td) * step;
        const contact = def.radius + p.radius + 3;
        const ox = px - qx;
        const oy = py - qy;
        if (ox * ox + oy * oy < contact * contact) risk += HORIZONS.length - h;
      }
    }
    return risk;
  }

  choose(sim: Sim): number {
    return priorityChoice(sim, sim.choices ?? [], true);
  }
}
