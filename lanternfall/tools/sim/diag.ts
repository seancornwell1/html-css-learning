/** Ad-hoc diagnostics: per-minute trace of one run. npx tsx tools/sim/diag.ts <bot> <seed> */
import { Sim } from '../../src/sim/sim';
import { createBot, isBotName } from './bots/index';

const botName = process.argv[2] ?? 'average';
const seed = Number(process.argv[3] ?? 1);
if (!isBotName(botName)) throw new Error(`unknown bot ${botName}`);
const sim = new Sim({ seed, events: false });
const bot = createBot(botName, seed);
const intent = { moveX: 0, moveY: 0, action: false };
let dist = 0;
let lastHp = sim.player.hp;
let dmgTaken = 0;
while (sim.status === 'running') {
  if (sim.choices) {
    sim.choose(bot.choose(sim));
    continue;
  }
  const x = sim.player.x;
  const y = sim.player.y;
  sim.step(bot.decide(sim, intent));
  dist += Math.hypot(sim.player.x - x, sim.player.y - y);
  if (sim.player.hp < lastHp) dmgTaken += lastHp - sim.player.hp;
  lastHp = sim.player.hp;
  if (sim.tick % 1800 === 0) {
    // Enemies within 300 px of the player.
    const n = sim.enemyGrid.query(sim.player.x, sim.player.y, 300, sim.scratch);
    console.log(
      `${(sim.time / 60).toFixed(1)}m alive=${sim.enemies.count} near300≈${n} kills=${sim.kills} lv=${sim.level} hp=${sim.player.hp.toFixed(0)} taken=${dmgTaken.toFixed(0)} dist=${(dist / 1000).toFixed(1)}k weapons=${sim.weapons.map((w) => w.level).join('/')}`,
    );
  }
}
console.log(sim.status, sim.time.toFixed(1));
