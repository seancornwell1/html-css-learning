/**
 * Isolated bot scenarios: one threat type, nothing else (director spawns are
 * cleared every tick). npx tsx tools/sim/scenario.ts <bot> <enemy_id> [count]
 */
import { ENEMIES } from '../../src/data/enemies';
import { Sim } from '../../src/sim/sim';
import { createBot, isBotName } from './bots/index';

const botName = process.argv[2] ?? 'skilled';
const enemy = process.argv[3] ?? 'long_neck';
const count = Number(process.argv[4] ?? 3);
if (!isBotName(botName)) throw new Error('bad bot');
const kind = ENEMIES.findIndex((e) => e.id === enemy);
let totalHits = 0;
for (let seed = 1; seed <= 5; seed++) {
  const sim = new Sim({ seed, events: true });
  sim.weapons.length = 0; // pure dodging
  const bot = createBot(botName, seed);
  const intent = { moveX: 0, moveY: 0, action: false };
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    sim.spawnEnemy(kind, Math.cos(a) * 260, Math.sin(a) * 260);
  }
  let hits = 0;
  for (let t = 0; t < 30 * 60 && sim.status === 'running'; t++) {
    const e = sim.enemies;
    for (let i = e.count - 1; i >= 0; i--) {
      const s = e.slots[i] as number;
      if (e.kind[s] !== kind) e.remove(s);
    }
    if (sim.choices) sim.choose(0);
    sim.step(bot.decide(sim, intent));
    sim.events.drain((ev) => {
      if (ev.type === 'player_hit') hits++;
    });
  }
  totalHits += hits;
  console.log(`seed ${seed}: hits in 30 s = ${hits}`);
}
console.log(`${botName} vs ${count} ${enemy}: ${totalHits} hits total`);
