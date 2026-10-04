import { describe, expect, it } from 'vitest';
import { ENEMY_KIND } from '../src/data/enemies';
import { PASSIVES, passiveIndex } from '../src/data/passives';
import { WEAPONS, weaponIndex } from '../src/data/weapons';
import { TICK_RATE } from '../src/sim/constants';
import { IDLE_INTENT } from '../src/sim/intent';
import { PICKUP } from '../src/sim/pickup-pool';
import { Sim } from '../src/sim/sim';

function run(sim: Sim, seconds: number): void {
  const end = sim.tick + seconds * TICK_RATE;
  while (sim.status === 'running' && sim.tick < end) {
    if (sim.choices) sim.choose(0);
    else sim.step(IDLE_INTENT);
  }
}

describe('passives and stats', () => {
  it('passives raise their stat per level and max HP keeps lost HP lost', () => {
    const sim = new Sim({ seed: 1, events: false });
    sim.player.hp = 50;
    sim.passives.push({ passive: passiveIndex('whetstone'), level: 3 });
    sim.recomputeStats();
    expect(sim.stats.might).toBeCloseTo(1.24);
    const ink = { passive: passiveIndex('ink_well'), level: 5 };
    sim.passives.push(ink);
    sim.recomputeStats();
    expect(sim.stats.amount).toBe(3);
    expect(sim.player.hp).toBe(50);
  });
});

describe('reliquaries and evolution', () => {
  it('a maxed weapon + maxed paired passive evolves on opening a reliquary', () => {
    const sim = new Sim({ seed: 2, events: false });
    const flail = sim.weapons[0];
    if (!flail) throw new Error('no start weapon');
    flail.level = 8;
    sim.passives.push({ passive: passiveIndex('iron_wick'), level: 5 });
    sim.recomputeStats();
    sim.pickups.drop(PICKUP.reliquary, 0, 0);
    sim.step(IDLE_INTENT);
    expect(sim.weapons[0]?.weapon).toBe(weaponIndex('sunfall_censer'));
    expect(sim.retired.has(weaponIndex('lantern_flail'))).toBe(true);
    expect(sim.evolutions.map((e) => e.weapon)).toEqual(['sunfall_censer']);
  });

  it('without an evolution a reliquary levels something up', () => {
    const sim = new Sim({ seed: 3, events: false });
    sim.pickups.drop(PICKUP.reliquary, 0, 0);
    sim.step(IDLE_INTENT);
    expect(sim.weapons[0]?.level).toBeGreaterThan(1);
  });

  it('elites drop reliquaries', () => {
    const sim = new Sim({ seed: 4, events: false });
    const slot = sim.spawnEnemy(ENEMY_KIND.bride_of_the_reservoir, 500, 0);
    sim.damageEnemy(slot, 1e9, 0, 0, 0);
    expect(sim.pickups.count).toBe(1);
    expect(sim.pickups.kind[sim.pickups.slots[0] as number]).toBe(PICKUP.reliquary);
  });
});

describe('every weapon fires and deals damage', () => {
  for (const def of WEAPONS) {
    it(def.id, () => {
      const sim = new Sim({ seed: 5, events: false });
      sim.weapons.length = 0;
      sim.weapons.push({
        weapon: weaponIndex(def.id),
        level: 1,
        cooldown: 0,
        fired: 0,
        hits: 0,
        active: 0,
      });
      // A ring of sturdy targets close by.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        sim.spawnEnemy(ENEMY_KIND.faceless_walker, Math.cos(a) * 120, Math.sin(a) * 120);
      }
      run(sim, 4);
      expect(sim.damageByWeapon[weaponIndex(def.id)], def.id).toBeGreaterThan(0);
    });
  }
});

describe('passive data', () => {
  it('has ids, names and at least one level', () => {
    for (const p of PASSIVES) {
      expect(p.perLevel.length).toBeGreaterThan(0);
      expect(p.name.length).toBeGreaterThan(0);
    }
  });
});

describe('hidden unions', () => {
  it('two evolved ingredients + a reliquary fuse into a union and free a slot', () => {
    const sim = new Sim({ seed: 6, events: false });
    sim.grant([
      { id: 'moth_lords_veil', level: 1 },
      { id: 'nine_tailed_inferno', level: 1 },
    ]);
    sim.pickups.drop(PICKUP.reliquary, 0, 0);
    sim.step(IDLE_INTENT);
    expect(sim.weapons.map((w) => WEAPONS[w.weapon]?.id)).toEqual(['lantern_festival']);
  });

  it('Lanternfall only forms for Akari', () => {
    const grant = [
      { id: 'sunfall_censer', level: 1 },
      { id: 'eye_of_the_still_pond', level: 1 },
    ];
    const ren = new Sim({ seed: 7, events: false, character: 'ren' });
    ren.grant(grant);
    ren.pickups.drop(PICKUP.reliquary, 0, 0);
    ren.step(IDLE_INTENT);
    expect(ren.weapons.some((w) => WEAPONS[w.weapon]?.id === 'lanternfall')).toBe(false);
    const akari = new Sim({ seed: 7, events: false, character: 'akari' });
    akari.grant(grant);
    akari.pickups.drop(PICKUP.reliquary, 0, 0);
    akari.step(IDLE_INTENT);
    expect(akari.weapons.map((w) => WEAPONS[w.weapon]?.id)).toEqual(['lanternfall']);
  });
});
