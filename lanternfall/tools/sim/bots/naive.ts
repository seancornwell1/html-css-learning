import { len2 } from '../../../src/sim/vec';
import type { Intent } from '../../../src/sim/intent';
import { Rng } from '../../../src/sim/rng';
import type { Sim } from '../../../src/sim/sim';
import type { Bot } from './bot';
import { nearestEnemy } from './sense';

/** Reaction time: re-decides every 12 ticks (200 ms). */
const THINK_EVERY = 12;

/**
 * Naive (GAME_DESIGN §10): runs straight away from the nearest enemy, picks
 * upgrades at random, never goes for pickups on purpose.
 */
export class NaiveBot implements Bot {
  readonly name = 'naive';
  private readonly rng: Rng;
  private mx = 0;
  private my = 0;

  constructor(seed: number) {
    this.rng = new Rng(seed ^ 0x4a17e);
  }

  decide(sim: Sim, out: Intent): Intent {
    if (sim.tick % THINK_EVERY === 0) {
      const s = nearestEnemy(sim, 400);
      if (s >= 0) {
        const dx = sim.player.x - (sim.enemies.x[s] as number);
        const dy = sim.player.y - (sim.enemies.y[s] as number);
        const d = len2(dx, dy) || 1;
        this.mx = dx / d;
        this.my = dy / d;
      } else {
        this.mx = 0;
        this.my = 0;
      }
    }
    out.moveX = this.mx;
    out.moveY = this.my;
    out.action = false;
    return out;
  }

  choose(sim: Sim): number {
    return this.rng.int(0, (sim.choices?.length ?? 1) - 1);
  }
}
