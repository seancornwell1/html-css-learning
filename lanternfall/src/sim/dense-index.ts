/**
 * Fixed-capacity slot allocator that keeps live slots dense in
 * `slots[0..count)` (swap-remove). Iteration is allocation-free and its
 * order is deterministic. Pools own their data arrays and use this for
 * bookkeeping.
 */
export class DenseIndex {
  readonly capacity: number;
  /** Dense list of live slot indices. */
  readonly slots: Int32Array;
  count = 0;
  private readonly free: Int32Array;
  private freeCount: number;
  /** Position of each slot inside `slots`, or -1 when free. */
  private readonly where: Int32Array;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.slots = new Int32Array(capacity);
    this.where = new Int32Array(capacity).fill(-1);
    this.free = new Int32Array(capacity);
    for (let i = 0; i < capacity; i++) this.free[i] = capacity - 1 - i;
    this.freeCount = capacity;
  }

  /** Returns a slot index, or -1 when full. */
  alloc(): number {
    if (this.freeCount === 0) return -1;
    const slot = this.free[--this.freeCount] as number;
    this.where[slot] = this.count;
    this.slots[this.count++] = slot;
    return slot;
  }

  release(slot: number): void {
    const at = this.where[slot] as number;
    if (at < 0) return;
    const last = this.slots[--this.count] as number;
    this.slots[at] = last;
    this.where[last] = at;
    this.where[slot] = -1;
    this.free[this.freeCount++] = slot;
  }

  isAlive(slot: number): boolean {
    return slot >= 0 && slot < this.capacity && (this.where[slot] as number) >= 0;
  }
}
