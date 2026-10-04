import { DenseIndex } from './dense-index';

/** Spirit Embers (XP pickups). */
export class EmberPool {
  readonly index: DenseIndex;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly value: Float64Array;
  /** 1 once inside the magnet radius: it then homes in on the player. */
  readonly attracted: Uint8Array;
  readonly speed: Float64Array;

  constructor(capacity: number) {
    this.index = new DenseIndex(capacity);
    this.x = new Float64Array(capacity);
    this.y = new Float64Array(capacity);
    this.value = new Float64Array(capacity);
    this.attracted = new Uint8Array(capacity);
    this.speed = new Float64Array(capacity);
  }

  get count(): number {
    return this.index.count;
  }

  get slots(): Int32Array {
    return this.index.slots;
  }

  /**
   * Drop an ember. When the pool is full the value merges into an existing
   * ember instead (GAME_DESIGN §7.1), so XP is never lost.
   */
  drop(x: number, y: number, value: number): void {
    const slot = this.index.alloc();
    if (slot < 0) {
      // Merge into the oldest-placed dense entry; deterministic.
      const target = this.index.slots[0] as number;
      this.value[target] = (this.value[target] as number) + value;
      return;
    }
    this.x[slot] = x;
    this.y[slot] = y;
    this.value[slot] = value;
    this.attracted[slot] = 0;
    this.speed[slot] = 0;
  }

  remove(slot: number): void {
    this.index.release(slot);
  }
}
