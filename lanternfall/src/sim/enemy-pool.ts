import { DenseIndex } from './dense-index';

/** Structure-of-arrays enemy storage (see DenseIndex). */
export class EnemyPool {
  readonly index: DenseIndex;
  readonly id: Uint32Array;
  readonly kind: Uint8Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly hp: Float64Array;
  readonly maxHp: Float64Array;
  /** Contact damage, already scaled for the minute it spawned in. */
  readonly damage: Float64Array;
  /** Knockback velocity, px/s; decays every tick. */
  readonly kbx: Float64Array;
  readonly kby: Float64Array;
  /** Behaviour timer (e.g. hop phase), seconds. */
  readonly timer: Float64Array;
  /** Behaviour direction (e.g. hop heading), unit vector. */
  readonly dirX: Float64Array;
  readonly dirY: Float64Array;
  /** Seconds of slow left, and how much speed it removes (0..1). */
  readonly slowT: Float64Array;
  readonly slowAmt: Float64Array;
  /** Seconds of freeze left (no movement). */
  readonly freezeT: Float64Array;
  /** Movement-speed multiplier fixed at spawn (curse). */
  readonly speedMul: Float64Array;
  /** Velocity actually moved last tick (bots predict with it). */
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  /** Behaviour state machine: state id, time in state, spare timer. */
  readonly state: Uint8Array;
  readonly stateT: Float64Array;
  readonly aux: Float64Array;
  /** 1 = marching in a fixed direction (procession), ignoring the player. */
  readonly march: Uint8Array;
  private nextId = 1;

  constructor(capacity: number) {
    this.index = new DenseIndex(capacity);
    this.id = new Uint32Array(capacity);
    this.kind = new Uint8Array(capacity);
    this.x = new Float64Array(capacity);
    this.y = new Float64Array(capacity);
    this.hp = new Float64Array(capacity);
    this.maxHp = new Float64Array(capacity);
    this.damage = new Float64Array(capacity);
    this.kbx = new Float64Array(capacity);
    this.kby = new Float64Array(capacity);
    this.timer = new Float64Array(capacity);
    this.dirX = new Float64Array(capacity);
    this.dirY = new Float64Array(capacity);
    this.slowT = new Float64Array(capacity);
    this.slowAmt = new Float64Array(capacity);
    this.freezeT = new Float64Array(capacity);
    this.speedMul = new Float64Array(capacity);
    this.vx = new Float64Array(capacity);
    this.vy = new Float64Array(capacity);
    this.state = new Uint8Array(capacity);
    this.stateT = new Float64Array(capacity);
    this.aux = new Float64Array(capacity);
    this.march = new Uint8Array(capacity);
  }

  get count(): number {
    return this.index.count;
  }

  get slots(): Int32Array {
    return this.index.slots;
  }

  get capacity(): number {
    return this.index.capacity;
  }

  /** Returns the slot index, or -1 when full. */
  spawn(kind: number, x: number, y: number, hp: number, damage = 0): number {
    const slot = this.index.alloc();
    if (slot < 0) return -1;
    this.id[slot] = this.nextId++;
    this.kind[slot] = kind;
    this.x[slot] = x;
    this.y[slot] = y;
    this.hp[slot] = hp;
    this.maxHp[slot] = hp;
    this.damage[slot] = damage;
    this.kbx[slot] = 0;
    this.kby[slot] = 0;
    this.timer[slot] = 0;
    this.dirX[slot] = 0;
    this.dirY[slot] = 0;
    this.slowT[slot] = 0;
    this.slowAmt[slot] = 0;
    this.freezeT[slot] = 0;
    this.speedMul[slot] = 1;
    this.vx[slot] = 0;
    this.vy[slot] = 0;
    this.state[slot] = 0;
    this.stateT[slot] = 0;
    this.aux[slot] = 0;
    this.march[slot] = 0;
    return slot;
  }

  remove(slot: number): void {
    this.index.release(slot);
  }

  isAlive(slot: number): boolean {
    return this.index.isAlive(slot);
  }
}
