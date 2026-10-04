import { describe, expect, it } from 'vitest';
import { Rng } from '../src/sim/rng';
import { SpatialHash } from '../src/sim/spatial-hash';

describe('SpatialHash', () => {
  it('returns every item within the radius (superset), no duplicates', () => {
    const n = 400;
    const xs = new Float64Array(n);
    const ys = new Float64Array(n);
    const slots = new Int32Array(n);
    const rng = new Rng(11);
    for (let i = 0; i < n; i++) {
      xs[i] = rng.range(-3000, 3000);
      ys[i] = rng.range(-3000, 3000);
      slots[i] = i;
    }
    const grid = new SpatialHash(n, 64, 6); // tiny table forces bucket collisions
    grid.build(slots, n, xs, ys);
    const out = new Int32Array(n);
    for (let q = 0; q < 50; q++) {
      const x = rng.range(-3000, 3000);
      const y = rng.range(-3000, 3000);
      const r = rng.range(10, 400);
      const got = Array.from(out.subarray(0, grid.query(x, y, r, out)));
      expect(new Set(got).size).toBe(got.length);
      for (let i = 0; i < n; i++) {
        if (Math.hypot((xs[i] as number) - x, (ys[i] as number) - y) <= r) {
          expect(got).toContain(i);
        }
      }
    }
  });
});
