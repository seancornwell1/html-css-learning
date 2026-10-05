import { DenseIndex } from './dense-index';

/**
 * Ground hazards owned by the player's weapons (fox fire, embers, smoke).
 * Each zone damages every enemy inside it once per `tick`.
 */
export class ZonePool {
  readonly index: DenseIndex;
  readonly weapon: Uint8Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly radius: Float64Array;
  readonly damage: Float64Array;
  readonly tick: Float64Array;
  readonly timer: Float64Array;
  readonly life: Float64Array;
  readonly maxLife: Float64Array;
  readonly slow: Float64Array;
  /** px/s toward the nearest enemy (0 = static). */
  readonly chase: Float64Array;

  constructor(capacity: number) {
    this.index = new DenseIndex(capacity);
    this.weapon = new Uint8Array(capacity);
    this.x = new Float64Array(capacity);
    this.y = new Float64Array(capacity);
    this.radius = new Float64Array(capacity);
    this.damage = new Float64Array(capacity);
    this.tick = new Float64Array(capacity);
    this.timer = new Float64Array(capacity);
    this.life = new Float64Array(capacity);
    this.maxLife = new Float64Array(capacity);
    this.slow = new Float64Array(capacity);
    this.chase = new Float64Array(capacity);
  }

  get count(): number {
    return this.index.count;
  }

  get slots(): Int32Array {
    return this.index.slots;
  }

  spawn(
    weapon: number,
    x: number,
    y: number,
    radius: number,
    damage: number,
    tick: number,
    life: number,
  ): number {
    const s = this.index.alloc();
    if (s < 0) return -1;
    this.weapon[s] = weapon;
    this.x[s] = x;
    this.y[s] = y;
    this.radius[s] = radius;
    this.damage[s] = damage;
    this.tick[s] = tick;
    this.timer[s] = 0;
    this.life[s] = life;
    this.maxLife[s] = life;
    this.slow[s] = 0;
    this.chase[s] = 0;
    return s;
  }

  remove(slot: number): void {
    this.index.release(slot);
  }
}
