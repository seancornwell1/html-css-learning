import type { Intent } from '../../../src/sim/intent';
import type { Sim } from '../../../src/sim/sim';

/**
 * A scripted player. Bots only read sim state, write an Intent and pick
 * upgrade cards, exactly like the keyboard/touch controllers and the
 * level-up UI do (CLAUDE.md, rule 3).
 */
export interface Bot {
  readonly name: string;
  decide(sim: Sim, out: Intent): Intent;
  /** Index into `sim.choices`. */
  choose(sim: Sim): number;
}
