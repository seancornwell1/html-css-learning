import { describe, expect, it } from 'vitest';
import { ENEMY_KIND } from '../src/data/enemies';
import { WEAPON_ID } from '../src/data/weapons';
import { TICK_RATE } from '../src/sim/constants';
import { IDLE_INTENT, type Intent } from '../src/sim/intent';
import { Sim } from '../src/sim/sim';

/** A deterministic scripted intent stream (circles the origin). */
function scripted(tick: number): Intent {
  const a = tick / 90;
  return { moveX: Math.cos(a), moveY: Math.sin(a), action: false };
}

/** Run until `ticks` sim ticks have passed or the run ends; always picks card 0. */
function advance(sim: Sim, ticks: number, intent: (t: number) => Intent = scripted): Sim {
  const end = sim.tick + ticks;
  while (sim.status === 'running' && sim.tick < end) {
    if (sim.choices) sim.choose(0);
    else sim.step(intent(sim.tick));
  }
  return sim;
}

describe('Sim determinism', () => {
  it('same seed + same intents and choices ⇒ same hash', () => {
    const a = advance(new Sim({ seed: 9 }), 120 * TICK_RATE);
    const b = advance(new Sim({ seed: 9 }), 120 * TICK_RATE);
    expect(a.level).toBeGreaterThan(1);
    expect(a.hash()).toBe(b.hash());
  });

  it('different seeds diverge', () => {
    const a = advance(new Sim({ seed: 1 }), 30 * TICK_RATE);
    const b = advance(new Sim({ seed: 2 }), 30 * TICK_RATE);
    expect(a.hash()).not.toBe(b.hash());
  });

  it('events on or off does not change the outcome', () => {
    const a = new Sim({ seed: 5 });
    const b = new Sim({ seed: 5, events: false });
    advance(a, 60 * TICK_RATE);
    advance(b, 60 * TICK_RATE);
    expect(a.events.length).toBeGreaterThan(0);
    expect(b.events.length).toBe(0);
    expect(a.hash()).toBe(b.hash());
  });
});

describe('Sim rules', () => {
  it('clamps diagonal movement to unit speed', () => {
    const sim = new Sim({ seed: 1 });
    sim.step({ moveX: 1, moveY: 1, action: false });
    expect(Math.hypot(sim.player.x, sim.player.y)).toBeCloseTo(sim.moveSpeed / TICK_RATE, 6);
  });

  it('starts with the Lantern Flail', () => {
    const sim = new Sim({ seed: 1 });
    expect(sim.weapons.map((w) => w.weapon)).toEqual([WEAPON_ID.lantern_flail]);
  });

  it('the flail kills a wisp in front of the player and drops an ember', () => {
    const sim = new Sim({ seed: 1, events: false });
    sim.enemies.spawn(ENEMY_KIND.wisp, 40, 0, 5, 1);
    advance(sim, TICK_RATE, () => IDLE_INTENT);
    expect(sim.kills).toBeGreaterThanOrEqual(1);
    expect(sim.damageByWeapon[WEAPON_ID.lantern_flail]).toBeGreaterThan(0);
  });

  it('collecting embers levels up, pauses the sim and offers cards', () => {
    const sim = new Sim({ seed: 1 });
    sim.embers.drop(0, 0, sim.xpNext);
    sim.step(IDLE_INTENT);
    expect(sim.level).toBe(2);
    expect(sim.choices?.length).toBeGreaterThan(0);
    const tick = sim.tick;
    sim.step(IDLE_INTENT);
    expect(sim.tick).toBe(tick); // paused while choosing
    sim.choose(0);
    expect(sim.choices).toBeNull();
    sim.step(IDLE_INTENT);
    expect(sim.tick).toBe(tick + 1);
  });

  it('queues several level-ups and offers cards for each', () => {
    const sim = new Sim({ seed: 3 });
    sim.embers.drop(0, 0, 5 + 15 + 25);
    sim.step(IDLE_INTENT);
    expect(sim.level).toBe(4);
    let picks = 0;
    while (sim.choices) {
      sim.choose(0);
      picks++;
    }
    expect(picks).toBe(3);
  });

  it('taking Ofuda Volley fires homing talismans that hit', () => {
    const sim = new Sim({ seed: 1, events: false });
    sim.embers.drop(0, 0, sim.xpNext);
    sim.step(IDLE_INTENT);
    const idx = sim.choices?.findIndex(
      (o) => o.type === 'weapon_new' && o.weapon === WEAPON_ID.ofuda_volley,
    );
    expect(idx).toBeGreaterThanOrEqual(0);
    sim.choose(idx ?? 0);
    sim.enemies.spawn(ENEMY_KIND.faceless_walker, 300, 0, 500, 1);
    advance(sim, 3 * TICK_RATE, () => IDLE_INTENT);
    expect(sim.damageByWeapon[WEAPON_ID.ofuda_volley]).toBeGreaterThan(0);
  });

  it('an idle player is eventually killed and the run ends', () => {
    const sim = advance(new Sim({ seed: 3, events: false }), 600 * TICK_RATE, () => IDLE_INTENT);
    expect(sim.status).toBe('dead');
    expect(sim.player.hp).toBe(0);
    const tick = sim.tick;
    sim.step(IDLE_INTENT);
    expect(sim.tick).toBe(tick);
  });
});
