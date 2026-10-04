import { DenseIndex } from './dense-index';

/** Kinds of floor pickup (GAME_DESIGN §7.1, §7.2). */
export const PICKUP = {
  reliquary: 0,
  onigiri: 1,
  coin: 2,
  lantern_burst: 3,
  spirit_call: 4,
  frenzy: 5,
} as const;

export type PickupKind = (typeof PICKUP)[keyof typeof PICKUP];

/** Walk-over pickups (not magnetised, except by Spirit Call for embers). */
export class PickupPool {
  readonly index: DenseIndex;
  readonly kind: Uint8Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly value: Float64Array;

  constructor(capacity: number) {
    this.index = new DenseIndex(capacity);
    this.kind = new Uint8Array(capacity);
    this.x = new Float64Array(capacity);
    this.y = new Float64Array(capacity);
    this.value = new Float64Array(capacity);
  }

  get count(): number {
    return this.index.count;
  }

  get slots(): Int32Array {
    return this.index.slots;
  }

  drop(kind: PickupKind, x: number, y: number, value = 0): number {
    const s = this.index.alloc();
    if (s < 0) return -1;
    this.kind[s] = kind;
    this.x[s] = x;
    this.y[s] = y;
    this.value[s] = value;
    return s;
  }

  remove(slot: number): void {
    this.index.release(slot);
  }
}
