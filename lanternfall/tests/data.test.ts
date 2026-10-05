import { describe, expect, it } from 'vitest';
import { PASSIVES, passiveIndex } from '../src/data/passives';
import { xpToNext } from '../src/data/progression';
import { TIMELINE } from '../src/data/timeline';
import { MAX_WEAPON_LEVEL, WEAPONS, weaponIndex, weaponStatsAt } from '../src/data/weapons';
import { Rng } from '../src/sim/rng';
import { legalOptions, rollChoices, type Loadout, type OwnedWeapon } from '../src/sim/upgrades';

const w = (weapon: number, level: number): OwnedWeapon => ({
  weapon,
  level,
  cooldown: 0,
  fired: 0,
  hits: 0,
  active: 0,
});

describe('data', () => {
  it('every base weapon has Lv 2..8 entries and stays sane at max level', () => {
    for (const def of WEAPONS.filter((d) => !d.evolvedFrom && !d.unionOf)) {
      expect(def.levels, def.id).toHaveLength(MAX_WEAPON_LEVEL - 1);
      const max = weaponStatsAt(def, MAX_WEAPON_LEVEL);
      expect(max.damage, def.id).toBeGreaterThan(def.base.damage);
      expect(max.cooldown, def.id).toBeGreaterThan(0);
    }
  });

  it('every evolution pairs an existing passive with an existing evolved weapon', () => {
    for (const def of WEAPONS) {
      if (def.evolvesInto) {
        const into = WEAPONS[weaponIndex(def.evolvesInto)];
        expect(into?.evolvedFrom, def.id).toBe(def.id);
        expect(() => passiveIndex(def.evolvePassive ?? '')).not.toThrow();
      }
      if (def.unionOf) for (const id of def.unionOf) expect(() => weaponIndex(id)).not.toThrow();
    }
    const ids = WEAPONS.map((d) => d.id).concat(PASSIVES.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('xp curve matches GAME_DESIGN §3.1', () => {
    expect(xpToNext(1)).toBe(5);
    expect(xpToNext(2)).toBe(15);
    expect(xpToNext(20)).toBe(195);
    expect(xpToNext(21)).toBe(208);
    expect(xpToNext(40)).toBe((195 + 13 * 20) * 1.5);
  });

  it('timeline segments are sorted and ramp up', () => {
    for (let i = 1; i < TIMELINE.length; i++) {
      const a = TIMELINE[i - 1];
      const b = TIMELINE[i];
      expect(b?.at).toBeGreaterThan(a?.at ?? 0);
      expect(b?.budget).toBeGreaterThanOrEqual(a?.budget ?? 0);
    }
  });

  it('upgrade rolls are distinct and fall back to healing', () => {
    const rng = new Rng(1);
    const start: Loadout = { weapons: [w(0, 1)], passives: [], retired: new Set() };
    const picks = rollChoices(start, rng);
    expect(new Set(picks.map((p) => JSON.stringify(p))).size).toBe(picks.length);
    const full: Loadout = {
      weapons: [0, 1, 2, 3, 4, 5].map((i) => w(i, MAX_WEAPON_LEVEL)),
      passives: [0, 1, 2, 3, 4, 5].map((i) => ({ passive: i, level: 5 })),
      retired: new Set(),
    };
    expect(legalOptions(full)).toHaveLength(0);
    expect(rollChoices(full, rng)).toEqual([{ type: 'heal', amount: 25 }]);
  });

  it('evolved weapons are never offered on level-up', () => {
    const opts = legalOptions({ weapons: [w(0, 1)], passives: [], retired: new Set([1]) });
    for (const o of opts) {
      if (o.type !== 'weapon_new') continue;
      expect(WEAPONS[o.weapon]?.evolvedFrom).toBeUndefined();
      expect(o.weapon).not.toBe(1);
    }
  });
});
