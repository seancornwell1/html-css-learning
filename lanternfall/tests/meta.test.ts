import { describe, expect, it } from 'vitest';
import { ENEMY_KIND } from '../src/data/enemies';
import { SHRINE, maxRanks } from '../src/data/meta';
import { SECRET_RULES } from '../src/data/powerups';
import { TICK_RATE } from '../src/sim/constants';
import { PICKUP } from '../src/sim/pickup-pool';
import { Sim } from '../src/sim/sim';
import { optionItem } from '../src/sim/upgrades';

const still = { moveX: 0, moveY: 0, action: false };

function clearEnemies(sim: Sim, keepProps = true): void {
  for (let i = sim.enemies.count - 1; i >= 0; i--) {
    const s = sim.enemies.slots[i] as number;
    const k = sim.enemies.kind[s];
    if (keepProps && (k === ENEMY_KIND.sealed_well || k === ENEMY_KIND.stone_lantern)) continue;
    sim.enemies.remove(s);
  }
}

/** Advance safely: no enemies but props, choices auto-picked. */
function advance(sim: Sim, seconds: number, onTick?: () => void): void {
  for (let i = 0; i < seconds * TICK_RATE && sim.status === 'running'; i++) {
    clearEnemies(sim);
    onTick?.();
    sim.step(still);
    if (sim.choices) sim.choose(0);
  }
}

describe('Shrine ranks', () => {
  it('apply to the stat block and the run tools', () => {
    const plain = new Sim({ seed: 1 });
    const meta = new Sim({ seed: 1, meta: maxRanks() });
    const might = SHRINE.find((r) => r.id === 'might');
    expect(meta.stats.might).toBeCloseTo(plain.stats.might + (might?.perRank ?? 0) * 5);
    expect(meta.stats.maxHp).toBe(plain.stats.maxHp + 15);
    expect(meta.player.hp).toBe(meta.stats.maxHp);
    expect(meta.stats.revival).toBe(plain.stats.revival);
    expect([meta.rerolls, meta.skips, meta.banishes]).toEqual([3, 3, 3]);
  });

  it('ignore ranks beyond the maximum', () => {
    const sim = new Sim({ seed: 1, meta: { might: 99 } });
    expect(sim.stats.might).toBeCloseTo(1.05);
  });
});

describe('run tools', () => {
  function atLevelUp(): Sim {
    const sim = new Sim({ seed: 2, meta: { reroll: 1, skip: 1, banish: 1 } });
    sim.weapons.length = 1;
    sim.embers.drop(sim.player.x, sim.player.y, 1000, 0, 0);
    for (let i = 0; i < 10 && !sim.choices; i++) sim.step(still);
    expect(sim.choices).not.toBeNull();
    return sim;
  }

  it('reroll redraws and spends a charge', () => {
    const sim = atLevelUp();
    expect(sim.reroll()).toBe(true);
    expect(sim.rerolls).toBe(0);
    expect(sim.choices).not.toBeNull();
    expect(sim.reroll()).toBe(false);
  });

  it('skip passes a level-up', () => {
    const sim = atLevelUp();
    const level = sim.level;
    while (sim.choices && sim.skips > 0) sim.skip();
    expect(sim.skips).toBe(0);
    expect(sim.level).toBe(level);
  });

  it('banish removes the item from every later draw', () => {
    const sim = atLevelUp();
    const item = optionItem(sim.choices?.[0] ?? { type: 'heal', amount: 0 });
    expect(sim.banish(0)).toBe(true);
    for (let i = 0; i < 30; i++) {
      sim.rerolls = 1;
      sim.reroll();
      expect(sim.choices?.some((o) => optionItem(o) === item)).toBe(false);
    }
  });
});

describe('secret characters', () => {
  it('Kagerou has fixed max HP and takes softer hits', () => {
    const k = new Sim({ seed: 1, character: 'kagerou', meta: maxRanks() });
    expect(k.stats.maxHp).toBe(75);
    expect(k.stats.curse).toBeCloseTo(1.2);
  });

  it('Ido floods every enemy at 5:00', () => {
    const sim = new Sim({ seed: 1, character: 'ido' });
    sim.weapons.length = 0;
    advance(sim, 299);
    const slot = sim.spawnEnemy(ENEMY_KIND.faceless_walker, 300, 0, true);
    const max = sim.enemies.maxHp[slot] as number;
    for (let i = 0; i < 2 * TICK_RATE; i++) {
      sim.step(still);
      if (sim.choices) sim.choose(0);
    }
    expect(sim.enemies.isAlive(slot) ? (sim.enemies.hp[slot] as number) : 0).toBeLessThan(
      max * 0.8,
    );
  });
});

describe('secrets', () => {
  it('Kagerou: reach 8:00 without Onigiri or regen', () => {
    const sim = new Sim({ seed: 3 });
    sim.weapons.length = 0;
    sim.stats.maxHp = 1e6;
    sim.player.hp = 1e6;
    advance(sim, SECRET_RULES.kagerouAt + 1);
    expect(sim.secrets).toContain('kagerou');
  });

  it('Kagerou: an Onigiri spoils it', () => {
    const sim = new Sim({ seed: 3 });
    sim.weapons.length = 0;
    sim.stats.maxHp = 1e6;
    sim.player.hp = 1e6;
    sim.pickups.drop(PICKUP.onigiri, sim.player.x, sim.player.y);
    advance(sim, SECRET_RULES.kagerouAt + 1);
    expect(sim.secrets).not.toContain('kagerou');
  });

  it('Ido: the Sealed Well appears far away; breaking it floods; outlasting reveals', () => {
    const sim = new Sim({ seed: 5 });
    sim.weapons.length = 0;
    sim.stats.maxHp = 1e6;
    sim.player.hp = 1e6;
    advance(sim, SECRET_RULES.wellAt + 1);
    let well = -1;
    for (let i = 0; i < sim.enemies.count; i++) {
      const s = sim.enemies.slots[i] as number;
      if (sim.enemies.kind[s] === ENEMY_KIND.sealed_well) well = s;
    }
    expect(well).toBeGreaterThanOrEqual(0);
    const d = Math.hypot(
      (sim.enemies.x[well] as number) - sim.player.x,
      (sim.enemies.y[well] as number) - sim.player.y,
    );
    expect(d).toBeGreaterThan(900);
    advance(sim, 20); // stays put while far away
    expect(sim.enemies.isAlive(well)).toBe(true);
    sim.damageEnemy(well, 1e9, 0, 0, 0);
    expect(sim.flood).toBeGreaterThan(0);
    advance(sim, SECRET_RULES.floodSeconds + 1);
    expect(sim.secrets).toContain('ido');
  });
});
