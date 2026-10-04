import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from '../src/core/loop';

describe('FixedStepLoop', () => {
  it('runs a fixed number of ticks regardless of frame pacing', () => {
    let ticks = 0;
    let lastAlpha = -1;
    const loop = new FixedStepLoop(
      {
        step: () => ticks++,
        render: (a) => (lastAlpha = a),
      },
      0.01,
    );
    for (let i = 0; i < 100; i++) loop.advance(0.0137);
    expect(ticks).toBe(137); // 1.37 s / 0.01 s
    expect(lastAlpha).toBeGreaterThanOrEqual(0);
    expect(lastAlpha).toBeLessThan(1);
  });

  it('clamps huge frames (tab switch) instead of spiralling', () => {
    let ticks = 0;
    const loop = new FixedStepLoop({ step: () => ticks++, render: () => {} }, 0.01);
    loop.advance(10);
    expect(ticks).toBe(25);
  });
});
