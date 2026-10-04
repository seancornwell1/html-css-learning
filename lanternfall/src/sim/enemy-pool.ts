/**
 * Structure-of-arrays enemy storage. Live enemies are kept dense in
 * `slots[0..count)` (swap-remove), so iteration is cache-friendly and
 * allocation-free. Order is deterministic.
 */
export class EnemyPool {
  readonly capacity: number;
  readonly id: Uint32Array;
  readonly kind: Uint8Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly hp: Float64Array;
  /** Dense list of live slot indices. */
  readonly slots: Int32Array;
  count = 0;
  private readonly free: Int32Array;
  private freeCount: number;
  /** Position of each slot inside `slots` (for O(1) removal). */
  private readonly where: Int32Array;
  private nextId = 1;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.id = new Uint32Array(capacity);
    this.kind = new Uint8Array(capacity);
    this.x = new Float64Array(capacity);
    this.y = new Float64Array(capacity);
    this.hp = new Float64Array(capacity);
    this.slots = new Int32Array(capacity);
    this.where = new Int32Array(capacity).fill(-1);
    this.free = new Int32Array(capacity);
    for (let i = 0; i < capacity; i++) this.free[i] = capacity - 1 - i;
    this.freeCount = capacity;
  }

  /** Returns the slot index, or -1 when full. */
  spawn(kind: number, x: number, y: number, hp: number): number {
    if (this.freeCount === 0) return -1;
    const slot = this.free[--this.freeCount] as number;
    this.id[slot] = this.nextId++;
    this.kind[slot] = kind;
    this.x[slot] = x;
    this.y[slot] = y;
    this.hp[slot] = hp;
    this.where[slot] = this.count;
    this.slots[this.count++] = slot;
    return slot;
  }

  remove(slot: number): void {
    const at = this.where[slot] as number;
    if (at < 0) return;
    const last = this.slots[--this.count] as number;
    this.slots[at] = last;
    this.where[last] = at;
    this.where[slot] = -1;
    this.free[this.freeCount++] = slot;
  }

  isAlive(slot: number): boolean {
    return (this.where[slot] as number) >= 0;
  }
}
