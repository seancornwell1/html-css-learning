import { ENEMIES } from '../../../src/data/enemies';
import { len2 } from '../../../src/sim/vec';
import type { Intent } from '../../../src/sim/intent';
import { Rng } from '../../../src/sim/rng';
import type { Sim } from '../../../src/sim/sim';
import type { Bot } from './bot';
import { nearestEmber, nearestPickup, priorityChoice } from './sense';

/** Reaction time: re-decides every 6 ticks (100 ms). */
const THINK_EVERY = 6;
/** Typical players let enemies come to about arm's length before backing off. */
const FEAR_RADIUS = 115;
const SAFE_RADIUS = 75;

/**
 * Average (GAME_DESIGN §10): potential-field kiting away from nearby
 * enemies, grabs embers when nothing is close, simple upgrade priorities.
 */
export class AverageBot implements Bot {
  readonly name = 'average';
  private readonly rng: Rng;
  private mx = 0;
  private my = 0;
  private dash = false;

  constructor(seed: number) {
    this.rng = new Rng(seed ^ 0xa4e);
  }

  decide(sim: Sim, out: Intent): Intent {
    if (sim.tick % THINK_EVERY === 0) this.think(sim);
    out.moveX = this.mx;
    out.moveY = this.my;
    out.action = this.dash;
    return out;
  }

  private think(sim: Sim): void {
    const p = sim.player;
    const e = sim.enemies;
    let fx = 0;
    let fy = 0;
    let closest = Infinity;
    const n = sim.enemyGrid.query(p.x, p.y, FEAR_RADIUS, sim.scratch);
    for (let k = 0; k < n; k++) {
      const s = sim.scratch[k] as number;
      if (!e.isAlive(s)) continue;
      const def = ENEMIES[e.kind[s] as number];
      const dx = p.x - (e.x[s] as number);
      const dy = p.y - (e.y[s] as number);
      const d = len2(dx, dy) - (def?.radius ?? 10);
      if (d >= FEAR_RADIUS) continue;
      closest = Math.min(closest, d);
      const w = (1 - Math.max(d, 1) / FEAR_RADIUS) ** 2;
      const len = len2(dx, dy) || 1;
      fx += (dx / len) * w;
      fy += (dy / len) * w;
    }
    // Shots and pending slams are threats too.
    const sh = sim.enemyShots;
    for (let i = 0; i < sh.count; i++) {
      const k = sh.slots[i] as number;
      if (sh.reflected[k]) continue;
      const dx = p.x - (sh.x[k] as number);
      const dy = p.y - (sh.y[k] as number);
      const d = len2(dx, dy) || 1;
      if (d > FEAR_RADIUS) continue;
      const w = (1 - d / FEAR_RADIUS) ** 2;
      fx += (dx / d) * w;
      fy += (dy / d) * w;
      closest = Math.min(closest, d);
    }
    const hz = sim.hazards;
    for (let i = 0; i < hz.count; i++) {
      const k = hz.slots[i] as number;
      if ((hz.delay[k] as number) <= 0) continue;
      const dx = p.x - (hz.x[k] as number);
      const dy = p.y - (hz.y[k] as number);
      const d = len2(dx, dy) || 1;
      if (d > (hz.radius[k] as number) + 30) continue;
      fx += (dx / d) * 1.5;
      fy += (dy / d) * 1.5;
      closest = 0;
    }
    this.dash = closest < 22 && sim.dashCooldown <= 0;
    if (closest > SAFE_RADIUS) {
      // Pickups (reliquaries, food) first, then embers.
      const pk = nearestPickup(sim, 500);
      const em = pk >= 0 ? -1 : nearestEmber(sim, 450);
      if (pk >= 0) {
        const dx = (sim.pickups.x[pk] as number) - p.x;
        const dy = (sim.pickups.y[pk] as number) - p.y;
        const d = len2(dx, dy) || 1;
        fx += (dx / d) * 1.2;
        fy += (dy / d) * 1.2;
      } else if (em >= 0) {
        const dx = (sim.embers.x[em] as number) - p.x;
        const dy = (sim.embers.y[em] as number) - p.y;
        const d = len2(dx, dy) || 1;
        fx += (dx / d) * 0.8;
        fy += (dy / d) * 0.8;
      }
    }
    // A little hesitation/noise, like a human thumb.
    fx += this.rng.range(-0.15, 0.15);
    fy += this.rng.range(-0.15, 0.15);
    const len = len2(fx, fy);
    if (len < 0.05) {
      this.mx = 0;
      this.my = 0;
    } else {
      this.mx = fx / len;
      this.my = fy / len;
    }
  }

  choose(sim: Sim): number {
    return priorityChoice(sim, sim.choices ?? []);
  }
}
