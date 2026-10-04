/**
 * Uniform grid over an unbounded world, hashed into a fixed bucket table and
 * rebuilt each tick with a counting sort (no allocation). Queries return
 * candidate slots; callers do the exact distance test.
 */
export class SpatialHash {
  private readonly mask: number;
  private readonly bucketStart: Int32Array;
  private readonly cursor: Int32Array;
  private readonly bucketOf: Int32Array;
  private readonly items: Int32Array;
  private readonly stamp: Int32Array;
  private queryId = 0;
  private itemCount = 0;

  constructor(
    capacity: number,
    readonly cellSize = 64,
    tableBits = 11,
  ) {
    const size = 1 << tableBits;
    this.mask = size - 1;
    this.bucketStart = new Int32Array(size + 1);
    this.cursor = new Int32Array(size);
    this.stamp = new Int32Array(size);
    this.bucketOf = new Int32Array(capacity);
    this.items = new Int32Array(capacity);
  }

  private bucket(cx: number, cy: number): number {
    return (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) & this.mask;
  }

  build(slots: Int32Array, count: number, xs: Float64Array, ys: Float64Array): void {
    const starts = this.bucketStart;
    starts.fill(0);
    const inv = 1 / this.cellSize;
    for (let i = 0; i < count; i++) {
      const s = slots[i] as number;
      const b = this.bucket(
        Math.floor((xs[s] as number) * inv),
        Math.floor((ys[s] as number) * inv),
      );
      this.bucketOf[i] = b;
      starts[b + 1] = (starts[b + 1] as number) + 1;
    }
    for (let b = 0; b < this.mask + 1; b++) {
      starts[b + 1] = (starts[b + 1] as number) + (starts[b] as number);
    }
    this.cursor.set(starts.subarray(0, this.mask + 1));
    for (let i = 0; i < count; i++) {
      const b = this.bucketOf[i] as number;
      const at = this.cursor[b] as number;
      this.items[at] = slots[i] as number;
      this.cursor[b] = at + 1;
    }
    this.itemCount = count;
  }

  /**
   * Write candidate slots near (x, y) within `r` into `out`; returns how many.
   * Stops when `out` is full.
   */
  query(x: number, y: number, r: number, out: Int32Array): number {
    if (this.itemCount === 0) return 0;
    const inv = 1 / this.cellSize;
    const cx0 = Math.floor((x - r) * inv);
    const cx1 = Math.floor((x + r) * inv);
    const cy0 = Math.floor((y - r) * inv);
    const cy1 = Math.floor((y + r) * inv);
    const id = ++this.queryId;
    let n = 0;
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const b = this.bucket(cx, cy);
        if (this.stamp[b] === id) continue;
        this.stamp[b] = id;
        const end = this.bucketStart[b + 1] as number;
        for (let k = this.bucketStart[b] as number; k < end; k++) {
          if (n >= out.length) return n;
          out[n++] = this.items[k] as number;
        }
      }
    }
    return n;
  }
}
