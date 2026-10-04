import { RUN_SECONDS, TICK_RATE } from '../../src/sim/constants';
import type { Intent } from '../../src/sim/intent';
import { Sim, type RunStatus } from '../../src/sim/sim';
import { WEAPONS } from '../../src/data/weapons';
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
  level: number;
  /** Level at 5:00, or the final level if the run ended earlier. */
  levelAt5: number;
  /** Damage dealt per weapon id. */
  damage: Record<string, number>;
  /** Lowest HP reached. */
  minHp: number;
  hash: number;
  wallMs: number;
  error?: string;
}

/** Hard stop so a broken build can never hang the sim. */
const MAX_TICKS = (RUN_SECONDS + 60) * TICK_RATE;
const FIVE_MINUTES = 300 * TICK_RATE;

export function runOne(job: RunJob): RunResult {
  const start = process.hrtime.bigint();
  const sim = new Sim({ seed: job.seed, events: false });
  const bot = createBot(job.bot, job.seed);
  const intent: Intent = { moveX: 0, moveY: 0, action: false };
  let levelAt5 = 0;
  let minHp = sim.player.hp;
  try {
    while (sim.status === 'running' && sim.tick < MAX_TICKS) {
      if (sim.choices) {
        sim.choose(bot.choose(sim));
        continue;
      }
      sim.step(bot.decide(sim, intent));
      if (sim.tick === FIVE_MINUTES) levelAt5 = sim.level;
      minHp = Math.min(minHp, sim.player.hp);
      if (!Number.isFinite(sim.player.hp) || !Number.isFinite(sim.player.x)) {
        throw new Error(`non-finite player state at tick ${sim.tick}`);
      }
    }
    return finish(job, sim, start, sim.status, levelAt5 || sim.level, minHp);
  } catch (err) {
    return { ...finish(job, sim, start, 'error', levelAt5, minHp), error: String(err) };
  }
}

function finish(
  job: RunJob,
  sim: Sim,
  start: bigint,
  status: RunResult['status'],
  levelAt5: number,
  minHp: number,
): RunResult {
  const damage: Record<string, number> = {};
  sim.damageByWeapon.forEach((d, i) => {
    if (d > 0) damage[WEAPONS[i]?.id ?? String(i)] = Math.round(d);
  });
  return {
    ...job,
    status,
    time: sim.time,
    kills: sim.kills,
    level: sim.level,
    levelAt5,
    damage,
    minHp,
    hash: sim.hash(),
    wallMs: Number(process.hrtime.bigint() - start) / 1e6,
  };
}
