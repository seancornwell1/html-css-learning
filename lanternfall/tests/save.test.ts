import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, defaultSave, migrate } from '../src/meta/save';

describe('save migration', () => {
  it('returns defaults for garbage', () => {
    expect(migrate(null)).toEqual(defaultSave());
    expect(migrate('nope')).toEqual(defaultSave());
  });

  it('keeps valid settings and clamps bad values', () => {
    const out = migrate({
      version: SAVE_VERSION,
      settings: {
        reduceFlashing: true,
        shake: 7,
        effects: 'ultra',
        noticeSeen: true,
        volMusic: 0.3,
        volSfx: -2,
      },
    });
    expect(out.settings).toEqual({
      reduceFlashing: true,
      shake: 1,
      effects: 'high',
      noticeSeen: true,
      volMaster: 0.8,
      volMusic: 0.3,
      volSfx: 0,
    });
  });
});

describe('save migration v1 → v2', () => {
  it('adds a profile and keeps settings', () => {
    const out = migrate({ version: 1, settings: { reduceFlashing: true, shake: 0.5 } });
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.profile.lastCharacter).toBe('akari');
    expect(out.profile.unlocked).toEqual(['akari', 'ren']);
    expect(out.profile.coins).toBe(0);
    expect(out.settings.reduceFlashing).toBe(true);
    expect(out.settings.shake).toBe(0.5);
  });
});

describe('save migration v2 → v3', () => {
  it('keeps the last character and adds meta progression', () => {
    const out = migrate({ version: 2, settings: {}, profile: { lastCharacter: 'tetsu' } });
    expect(out.profile.lastCharacter).toBe('tetsu');
    expect(out.profile.ranks).toEqual({});
    expect(out.profile.register).toEqual([]);
  });

  it('sanitizes hostile values', () => {
    const out = migrate({
      version: 3,
      profile: { coins: -50, ranks: { might: 'x', area: 2 }, unlocked: [1, 'hotaru'] },
    });
    expect(out.profile.coins).toBe(0);
    expect(out.profile.ranks).toEqual({ area: 2 });
    expect(out.profile.unlocked).toEqual(['akari', 'ren', 'hotaru']);
  });
});
