import { DenseIndex } from './dense-index';

/** Max distinct enemies one projectile remembers hitting. */
export const HIT_MEMORY = 8;

/** Player projectiles (structure of arrays). */
export class ProjectilePool {
  readonly index: DenseIndex;
  /** Weapon id that fired it. */
  readonly weapon: Uint8Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  readonly radius: Float64Array;
  readonly damage: Float64Array;
  readonly knockback: Float64Array;
  readonly life: Float64Array;
  /** Hits left before it vanishes. */
  readonly pierce: Float64Array;
  /** Homing target: enemy slot + id (id guards against slot reuse). */
  readonly targetSlot: Int32Array;
  readonly targetId: Uint32Array;
  /** Enemy ids already hit (ring of HIT_MEMORY per slot). */
  readonly hits: Uint32Array;
  readonly hitCount: Uint8Array;

  constructor(capacity: number) {
    this.index = new DenseIndex(capacity);
    this.weapon = new Uint8Array(capacity);
    this.x = new Float64Array(capacity);
    this.y = new Float64Array(capacity);
    this.vx = new Float64Array(capacity);
    this.vy = new Float64Array(capacity);
    this.radius = new Float64Array(capacity);
    this.damage = new Float64Array(capacity);
    this.knockback = new Float64Array(capacity);
    this.life = new Float64Array(capacity);
    this.pierce = new Float64Array(capacity);
    this.targetSlot = new Int32Array(capacity);
    this.targetId = new Uint32Array(capacity);
    this.hits = new Uint32Array(capacity * HIT_MEMORY);
    this.hitCount = new Uint8Array(capacity);
  }

  get count(): number {
    return this.index.count;
  }

  get slots(): Int32Array {
    return this.index.slots;
  }

  /** Returns the slot index, or -1 when full (the shot is dropped). */
  spawn(weapon: number, x: number, y: number, vx: number, vy: number): number {
    const slot = this.index.alloc();
    if (slot < 0) return -1;
    this.weapon[slot] = weapon;
    this.x[slot] = x;
    this.y[slot] = y;
    this.vx[slot] = vx;
    this.vy[slot] = vy;
    this.targetSlot[slot] = -1;
    this.targetId[slot] = 0;
    this.hitCount[slot] = 0;
    return slot;
  }

  hasHit(slot: number, enemyId: number): boolean {
    const n = Math.min(this.hitCount[slot] as number, HIT_MEMORY);
    const base = slot * HIT_MEMORY;
    for (let i = 0; i < n; i++) if (this.hits[base + i] === enemyId) return true;
    return false;
  }

  recordHit(slot: number, enemyId: number): void {
    const n = this.hitCount[slot] as number;
    this.hits[slot * HIT_MEMORY + (n % HIT_MEMORY)] = enemyId;
    this.hitCount[slot] = Math.min(n + 1, 255);
  }

  remove(slot: number): void {
    this.index.release(slot);
  }
}
