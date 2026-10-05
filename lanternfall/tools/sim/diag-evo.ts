/** Ad-hoc: when do bots max weapons/passives and collect reliquaries? npx tsx tools/sim/diag-evo.ts <bot> <seed> */
import { PASSIVES } from '../../src/data/passives';
import { WEAPONS } from '../../src/data/weapons';
import { Sim } from '../../src/sim/sim';
import { createBot, isBotName } from './bots/index';

const botName = process.argv[2] ?? 'skilled';
const seed = Number(process.argv[3] ?? 1);
if (!isBotName(botName)) throw new Error(`unknown bot ${botName}`);
const sim = new Sim({ seed, events: true });
const bot = createBot(botName, seed);
const intent = { moveX: 0, moveY: 0, action: false };
let reliquaries = 0;
while (sim.status === 'running') {
  if (sim.choices) {
    sim.choose(bot.choose(sim));
    continue;
  }
  sim.step(bot.decide(sim, intent));
  sim.events.drain((e) => {
    if (e.type === 'pickup' && e.kind === 0) {
      reliquaries++;
      const load =
        sim.weapons.map((w) => `${WEAPONS[w.weapon]?.id}:${w.level}`).join(' ') +
        ' | ' +
        sim.passives.map((p) => `${PASSIVES[p.passive]?.id}:${p.level}`).join(' ');
      console.log(`${sim.time.toFixed(0)}s reliquary #${reliquaries} lv${sim.level} ${load}`);
    }
    if (e.type === 'evolution') console.log(`  -> evolved ${WEAPONS[e.weapon]?.id}`);
    if (e.type === 'elite') console.log(`${sim.time.toFixed(0)}s elite spawned`);
  });
}
console.log(sim.status, sim.time.toFixed(0), 'reliquaries', reliquaries);
