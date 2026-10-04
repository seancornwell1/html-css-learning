import { RUN_SECONDS, TICK_RATE } from '../../src/sim/constants';
import type { Intent } from '../../src/sim/intent';
import { Sim, type RunStatus } from '../../src/sim/sim';
import { createBot, type BotName } from './bots/index';

export interface RunJob {
  seed: number;
  bot: BotName;
  character: string;
}

export interface RunResult extends RunJob {
  status: RunStatus | 'error';
  /** Seconds survived (sim time). */
  time: number;
  kills: number;
  hash: number;
  wallMs: number;
  error?: string;
}

/** Hard stop so a broken build can never hang the sim. */
const MAX_TICKS = (RUN_SECONDS + 60) * TICK_RATE;

export function runOne(job: RunJob): RunResult {
  const start = process.hrtime.bigint();
  const sim = new Sim({ seed: job.seed });
  const bot = createBot(job.bot, job.seed);
  const intent: Intent = { moveX: 0, moveY: 0, action: false };
  try {
    while (sim.status === 'running' && sim.tick < MAX_TICKS) {
      sim.step(bot.decide(sim, intent));
      sim.events.clear();
      if (!Number.isFinite(sim.player.hp) || !Number.isFinite(sim.player.x)) {
        throw new Error(`non-finite player state at tick ${sim.tick}`);
      }
    }
    return finish(job, sim, start, sim.status);
  } catch (err) {
    return { ...finish(job, sim, start, 'error'), error: String(err) };
  }
}

function finish(job: RunJob, sim: Sim, start: bigint, status: RunResult['status']): RunResult {
  return {
    ...job,
    status,
    time: sim.time,
    kills: sim.kills,
    hash: sim.hash(),
    wallMs: Number(process.hrtime.bigint() - start) / 1e6,
  };
}
