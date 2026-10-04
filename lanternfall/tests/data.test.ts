import { describe, expect, it } from 'vitest';
import { xpToNext } from '../src/data/progression';
import { TIMELINE } from '../src/data/timeline';
import { MAX_WEAPON_LEVEL, WEAPONS, weaponStatsAt } from '../src/data/weapons';
import { Rng } from '../src/sim/rng';
import { legalOptions, rollChoices } from '../src/sim/upgrades';

describe('data', () => {
  it('every weapon has Lv 2..8 entries and stays sane at max level', () => {
    for (const w of WEAPONS) {
      expect(w.levels).toHaveLength(MAX_WEAPON_LEVEL - 1);
      const max = weaponStatsAt(w, MAX_WEAPON_LEVEL);
      expect(max.damage).toBeGreaterThan(w.base.damage);
      expect(max.cooldown).toBeGreaterThan(0);
    }
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
    const owned = [{ weapon: 0, level: 1, cooldown: 0, fired: 0 }];
    const picks = rollChoices(owned, rng);
    expect(new Set(picks.map((p) => JSON.stringify(p))).size).toBe(picks.length);
    const maxed = WEAPONS.map((_, i) => ({
      weapon: i,
      level: MAX_WEAPON_LEVEL,
      cooldown: 0,
      fired: 0,
    }));
    expect(legalOptions(maxed)).toHaveLength(0);
    expect(rollChoices(maxed, rng)).toEqual([{ type: 'heal', amount: 25 }]);
  });
});
