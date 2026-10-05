import { DenseIndex } from './dense-index';

export const HAZARD = {
  /** Drowned puddle: slows the player while inside. */
  puddle: 0,
  /** Telegraphed slam: hurts the player if inside when the delay ends. */
  slam: 1,
} as const;

/** Enemy ground hazards and telegraphs. */
export class HazardPool {
  readonly index: DenseIndex;
  readonly kind: Uint8Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly radius: Float64Array;
  /** Seconds until it triggers (telegraph); ≤ 0 once active. */
  readonly delay: Float64Array;
  readonly total: Float64Array;
  readonly life: Float64Array;
  readonly damage: Float64Array;
  readonly slow: Float64Array;

  constructor(capacity: number) {
    this.index = new DenseIndex(capacity);
    this.kind = new Uint8Array(capacity);
    this.x = new Float64Array(capacity);
    this.y = new Float64Array(capacity);
    this.radius = new Float64Array(capacity);
    this.delay = new Float64Array(capacity);
    this.total = new Float64Array(capacity);
    this.life = new Float64Array(capacity);
    this.damage = new Float64Array(capacity);
    this.slow = new Float64Array(capacity);
  }

  get count(): number {
    return this.index.count;
  }

  get slots(): Int32Array {
    return this.index.slots;
  }

  spawn(kind: number, x: number, y: number, radius: number, delay: number, life: number): number {
    const s = this.index.alloc();
    if (s < 0) return -1;
    this.kind[s] = kind;
    this.x[s] = x;
    this.y[s] = y;
    this.radius[s] = radius;
    this.delay[s] = delay;
    this.total[s] = delay;
    this.life[s] = life;
    this.damage[s] = 0;
    this.slow[s] = 0;
    return s;
  }

  remove(slot: number): void {
    this.index.release(slot);
  }
}
