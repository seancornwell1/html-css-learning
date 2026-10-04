import { describe, expect, it } from 'vitest';
import { IDLE_INTENT, type Intent } from '../src/sim/intent';
import { Sim } from '../src/sim/sim';
import { TICK_RATE } from '../src/sim/constants';

/** A deterministic scripted intent stream (circles the origin). */
function scripted(tick: number): Intent {
  const a = tick / 90;
  return { moveX: Math.cos(a), moveY: Math.sin(a), action: false };
}

function play(seed: number, ticks: number): Sim {
  const sim = new Sim({ seed });
  for (let t = 0; t < ticks; t++) sim.step(scripted(t));
  return sim;
}

describe('Sim determinism', () => {
  it('same seed + same intents ⇒ same hash', () => {
    expect(play(9, 60 * TICK_RATE).hash()).toBe(play(9, 60 * TICK_RATE).hash());
  });

  it('different seeds diverge', () => {
    expect(play(1, 30 * TICK_RATE).hash()).not.toBe(play(2, 30 * TICK_RATE).hash());
  });

  it('draining events does not change the outcome', () => {
    const a = new Sim({ seed: 5 });
    const b = new Sim({ seed: 5 });
    for (let t = 0; t < 20 * TICK_RATE; t++) {
      a.step(scripted(t));
      b.step(scripted(t));
      a.events.drain(() => {});
    }
    expect(a.hash()).toBe(b.hash());
  });
});

describe('Sim rules', () => {
  it('clamps diagonal movement to unit speed', () => {
    const sim = new Sim({ seed: 1 });
    sim.step({ moveX: 1, moveY: 1, action: false });
    const moved = Math.hypot(sim.player.x, sim.player.y);
    expect(moved).toBeCloseTo(sim.player.moveSpeed / TICK_RATE, 6);
  });

  it('an idle player is eventually killed and the run ends', () => {
    const sim = new Sim({ seed: 3 });
    let events = 0;
    while (sim.status === 'running' && sim.tick < 600 * TICK_RATE) {
      sim.step(IDLE_INTENT);
      sim.events.drain(() => events++);
    }
    expect(sim.status).toBe('dead');
    expect(sim.player.hp).toBe(0);
    expect(events).toBeGreaterThan(0);
    const tick = sim.tick;
    sim.step(IDLE_INTENT);
    expect(sim.tick).toBe(tick);
  });
});
