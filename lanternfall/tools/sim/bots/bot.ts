import type { Intent } from '../../../src/sim/intent';
import type { Sim } from '../../../src/sim/sim';

/**
 * A scripted player. Bots only read sim state and write an Intent, exactly
 * like the keyboard and touch controllers do (CLAUDE.md, rule 3).
 */
export interface Bot {
  readonly name: string;
  decide(sim: Sim, out: Intent): Intent;
}
