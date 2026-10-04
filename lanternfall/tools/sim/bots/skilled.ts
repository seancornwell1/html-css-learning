import { ENEMIES } from '../../../src/data/enemies';
import type { Intent } from '../../../src/sim/intent';
import type { Sim } from '../../../src/sim/sim';
import type { Bot } from './bot';
import { effectiveSpeed, meleeReach, nearestEmber, priorityChoice } from './sense';
import { len2 } from '../../../src/sim/vec';

/** Reaction time: re-decides every 3 ticks (50 ms). */
const THINK_EVERY = 3;
const DIRECTIONS = 16;
const HORIZONS = [0.2, 0.5, 1.0] as const;
const HORIZON_WEIGHT = [3, 2, 1] as const;
const SENSE_RADIUS = 380;
/** Long-range scan for open space (escape routes before rings close). */
const OPEN_RADIUS = 560;
/** Same comfort zone as a decent human (see AverageBot). */
const FEAR_RADIUS = 115;
/** Cost of a predicted contact: about one hit, so it will trade a hit to break out. */
const CONTACT_COST = 400;

/**
 * Skilled (GAME_DESIGN §10): lookahead steering. Scores 16 headings plus
 * standing still by predicting where enemies will be over the next second,
 * fights at weapon reach, heads for open space early, and routes through
 * embers when it is safe.
 */
export class SkilledBot implements Bot {
  readonly name = 'skilled';
  private mx = 0;
  private my = 0;
  private readonly dirX = new Float64Array(DIRECTIONS + 1);
  private readonly dirY = new Float64Array(DIRECTIONS + 1);
  private readonly near = new Int32Array(512);
  private readonly sector = new Float64Array(DIRECTIONS);
  private readonly raw = new Float64Array(DIRECTIONS);

  constructor(_seed: number) {
    for (let i = 0; i < DIRECTIONS; i++) {
      const a = (i / DIRECTIONS) * Math.PI * 2;
      this.dirX[i] = Math.cos(a);
      this.dirY[i] = Math.sin(a);
    }
    // Last entry stays (0, 0): stand still.
  }

  decide(sim: Sim, out: Intent): Intent {
    if (sim.tick % THINK_EVERY === 0) this.think(sim);
    out.moveX = this.mx;
    out.moveY = this.my;
    out.action = false;
    return out;
  }

  /** Crowding per heading sector, smoothed over neighbours. */
  private scanSectors(sim: Sim): void {
    const p = sim.player;
    const e = sim.enemies;
    const raw = this.raw;
    raw.fill(0);
    const n = sim.enemyGrid.query(p.x, p.y, OPEN_RADIUS, this.near);
    for (let k = 0; k < n; k++) {
      const s = this.near[k] as number;
      if (!e.isAlive(s)) continue;
      const dx = (e.x[s] as number) - p.x;
      const dy = (e.y[s] as number) - p.y;
      const d = len2(dx, dy);
      if (d > OPEN_RADIUS) continue;
      const a = Math.atan2(dy, dx);
      const i =
        ((Math.round((a / (Math.PI * 2)) * DIRECTIONS) % DIRECTIONS) + DIRECTIONS) % DIRECTIONS;
      raw[i] = (raw[i] as number) + 1 / (1 + d / 150);
    }
    for (let i = 0; i < DIRECTIONS; i++) {
      const l = raw[(i + DIRECTIONS - 1) % DIRECTIONS] as number;
      const r = raw[(i + 1) % DIRECTIONS] as number;
      this.sector[i] = (raw[i] as number) + 0.5 * (l + r);
    }
  }

  private think(sim: Sim): void {
    const p = sim.player;
    const e = sim.enemies;
    const speed = sim.moveSpeed;
    this.scanSectors(sim);
    const n = sim.enemyGrid.query(p.x, p.y, SENSE_RADIUS, this.near);
    const reach = meleeReach(sim);

    // Preferred heading: the average player's kiting field.
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
      if (d >= FEAR_RADIUS) continue;
      const w = (1 - Math.max(d, 1) / FEAR_RADIUS) ** 2;
      fx += (ax / len) * w;
      fy += (ay / len) * w;
    }
    const fl = len2(fx, fy);
    if (fl > 0) {
      fx /= fl;
      fy /= fl;
    }

    // Ember to route toward, when nothing is close.
    const em = nearestEmber(sim, 500);
    let ex = 0;
    let ey = 0;
    if (em >= 0) {
      const dx = (sim.embers.x[em] as number) - p.x;
      const dy = (sim.embers.y[em] as number) - p.y;
      const d = len2(dx, dy) || 1;
      ex = dx / d;
      ey = dy / d;
    }

    let bestCost = Infinity;
    let bx = 0;
    let by = 0;
    for (let i = 0; i <= DIRECTIONS; i++) {
      const dx = this.dirX[i] as number;
      const dy = this.dirY[i] as number;
      let danger = 0;
      let inReach = 0;
      for (let h = 0; h < HORIZONS.length; h++) {
        const t = HORIZONS[h] as number;
        const w = HORIZON_WEIGHT[h] as number;
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
          const d = len2(px - qx, py - qy);
          const contact = def.radius + p.radius + 2;
          if (d < contact) danger += CONTACT_COST * w;
          const safe = contact + 25;
          if (d < safe) danger += 0.5 * (safe - d) * (safe - d) * w;
          if (h === 0 && d > safe - 10 && d < reach) inReach++;
        }
      }
      // Fight at arm's length: enemies inside weapon reach (not touching) are good.
      let cost = danger - 5 * Math.min(inReach, 12) - 60 * (dx * fx + dy * fy);
      if (i < DIRECTIONS) cost += 4 * (this.sector[i] as number);
      if (danger < 50 && closest > 60) cost -= 50 * (dx * ex + dy * ey);
      cost -= 8 * (dx * this.mx + dy * this.my);
      if (cost < bestCost) {
        bestCost = cost;
        bx = dx;
        by = dy;
      }
    }
    this.mx = bx;
    this.my = by;
  }

  choose(sim: Sim): number {
    return priorityChoice(sim, sim.choices ?? []);
  }
}
