import { describe, expect, it } from 'vitest';
import { EnemyPool } from '../src/sim/enemy-pool';

describe('EnemyPool', () => {
  it('spawns until full, then refuses', () => {
    const pool = new EnemyPool(3);
    expect(pool.spawn(0, 0, 0, 1)).toBeGreaterThanOrEqual(0);
    expect(pool.spawn(0, 0, 0, 1)).toBeGreaterThanOrEqual(0);
    expect(pool.spawn(0, 0, 0, 1)).toBeGreaterThanOrEqual(0);
    expect(pool.spawn(0, 0, 0, 1)).toBe(-1);
    expect(pool.count).toBe(3);
  });

  it('keeps the live list dense after removal and reuses slots', () => {
    const pool = new EnemyPool(4);
    const a = pool.spawn(0, 1, 0, 1);
    const b = pool.spawn(0, 2, 0, 1);
    const c = pool.spawn(0, 3, 0, 1);
    pool.remove(b);
    expect(pool.count).toBe(2);
    expect(pool.isAlive(b)).toBe(false);
    const live = Array.from(pool.slots.subarray(0, pool.count)).sort();
    expect(live).toEqual([a, c].sort());
    pool.remove(b); // double remove is a no-op
    expect(pool.count).toBe(2);
    const d = pool.spawn(1, 4, 0, 1);
    expect(pool.isAlive(d)).toBe(true);
    expect(pool.id[d]).toBe(4);
  });
});
