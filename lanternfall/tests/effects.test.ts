import { describe, expect, it } from 'vitest';
import {
  Decals,
  HitStop,
  MAX_DECALS,
  MAX_FLASH_HZ,
  ScreenFx,
  Shake,
  type FxParams,
} from '../src/render/effects';

const params = (): FxParams => ({ invert: 0, fade: 0, ca: 0, impact: 0, time: 0, frenzy: 0 });

describe('ScreenFx', () => {
  it('never flashes the full screen more than 3 times per second', () => {
    const fx = new ScreenFx();
    let flashes = 0;
    // Request a flash every frame for 2 s at 60 fps.
    for (let i = 0; i < 120; i++) {
      if (fx.flash(0.07)) flashes++;
      fx.update(1 / 60);
    }
    expect(flashes).toBeLessThanOrEqual(2 * MAX_FLASH_HZ);
  });

  it('reduce flashing turns inversions into a soft fade', () => {
    const fx = new ScreenFx();
    fx.reduceFlashing = true;
    fx.flash(0.07);
    fx.impactFrame(1);
    const p = fx.params(params());
    expect(p.invert).toBe(0);
    expect(p.fade).toBeGreaterThan(0);
    expect(p.impact).toBeLessThanOrEqual(0.4);
  });

  it('inverts normally and the inversion ends', () => {
    const fx = new ScreenFx();
    fx.flash(0.07);
    expect(fx.params(params()).invert).toBe(1);
    fx.update(0.1);
    expect(fx.params(params()).invert).toBe(0);
  });
});

describe('Shake', () => {
  it('decays to rest and respects the user scale', () => {
    const s = new Shake();
    s.scale = 0;
    s.add(1);
    s.update(0.016);
    expect(s.x).toBe(0);
    s.scale = 1;
    s.update(0.016);
    expect(Math.abs(s.x) + Math.abs(s.y)).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) s.update(1 / 60);
    expect(s.trauma).toBe(0);
    expect(s.x).toBe(0);
  });
});

describe('HitStop and Decals', () => {
  it('hit-stop keeps the longest request', () => {
    const h = new HitStop();
    h.trigger(100, 0);
    h.trigger(30, 10);
    expect(h.active(90)).toBe(true);
    expect(h.active(101)).toBe(false);
  });

  it('decals overwrite the oldest when full', () => {
    const d = new Decals();
    for (let i = 0; i < MAX_DECALS + 5; i++) d.add(i, 0, 1, 6);
    expect(d.x[0]).toBe(MAX_DECALS);
    expect(d.x[4]).toBe(MAX_DECALS + 4);
    expect(d.x[5]).toBe(5);
  });
});
