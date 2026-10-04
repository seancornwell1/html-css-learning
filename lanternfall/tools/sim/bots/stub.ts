import type { Intent } from '../../../src/sim/intent';
import { Rng } from '../../../src/sim/rng';
import type { Sim } from '../../../src/sim/sim';
import type { Bot } from './bot';

/**
 * M0 placeholder: flee from the nearest enemy with a little seeded wander.
 * Replaced by the naive / average / skilled bots in M1.
 */
export class StubBot implements Bot {
  readonly name = 'stub';
  private readonly rng: Rng;
  private wanderX = 0;
  private wanderY = 0;

  constructor(seed: number) {
    this.rng = new Rng(seed ^ 0x5eed);
  }

  decide(sim: Sim, out: Intent): Intent {
    const p = sim.player;
    const e = sim.enemies;
    let best = Infinity;
    let fx = 0;
    let fy = 0;
    for (let i = 0; i < e.count; i++) {
      const s = e.slots[i] as number;
      const dx = p.x - (e.x[s] as number);
      const dy = p.y - (e.y[s] as number);
      const d2 = dx * dx + dy * dy;
      if (d2 < best) {
        best = d2;
        fx = dx;
        fy = dy;
      }
    }
    if (sim.tick % 60 === 0) {
      const a = this.rng.range(0, Math.PI * 2);
      this.wanderX = Math.cos(a) * 0.3;
      this.wanderY = Math.sin(a) * 0.3;
    }
    const len = Math.hypot(fx, fy) || 1;
    out.moveX = fx / len + this.wanderX;
    out.moveY = fy / len + this.wanderY;
    out.action = false;
    return out;
  }
}
