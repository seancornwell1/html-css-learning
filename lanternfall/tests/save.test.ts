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
      settings: { reduceFlashing: true, shake: 7, effects: 'ultra', noticeSeen: true },
    });
    expect(out.settings).toEqual({
      reduceFlashing: true,
      shake: 1,
      effects: 'high',
      noticeSeen: true,
    });
  });
});
