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
   * Drop an ember. When the pool is full, the ember furthest from the
   * player (px, py) is recycled into this one, carrying its XP along, so
   * light left far behind is not lost and the cap never strands new drops.
   */
  drop(x: number, y: number, value: number, px = x, py = y): void {
    let slot = this.index.alloc();
    if (slot < 0) {
      let far = -1;
      let farD2 = -1;
      for (let i = 0; i < this.index.count; i++) {
        const s = this.index.slots[i] as number;
        const dx = (this.x[s] as number) - px;
        const dy = (this.y[s] as number) - py;
        const d2 = dx * dx + dy * dy;
        if (d2 > farD2) {
          farD2 = d2;
          far = s;
        }
      }
      if (far < 0) return;
      slot = far;
      value += this.value[far] as number;
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
