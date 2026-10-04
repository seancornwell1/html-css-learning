import { DenseIndex } from './dense-index';

/** Enemy projectiles (Lantern Mouth orbs, Mother's volleys). */
export class EnemyShotPool {
  readonly index: DenseIndex;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  readonly radius: Float64Array;
  readonly damage: Float64Array;
  readonly life: Float64Array;
  /** 1 once reflected by the Hundred-Year Parasol: it then hurts enemies. */
  readonly reflected: Uint8Array;

  constructor(capacity: number) {
    this.index = new DenseIndex(capacity);
    this.x = new Float64Array(capacity);
    this.y = new Float64Array(capacity);
    this.vx = new Float64Array(capacity);
    this.vy = new Float64Array(capacity);
    this.radius = new Float64Array(capacity);
    this.damage = new Float64Array(capacity);
    this.life = new Float64Array(capacity);
    this.reflected = new Uint8Array(capacity);
  }

  get count(): number {
    return this.index.count;
  }

  get slots(): Int32Array {
    return this.index.slots;
  }

  spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    radius: number,
    damage: number,
    life: number,
  ): number {
    const s = this.index.alloc();
    if (s < 0) return -1;
    this.x[s] = x;
    this.y[s] = y;
    this.vx[s] = vx;
    this.vy[s] = vy;
    this.radius[s] = radius;
    this.damage[s] = damage;
    this.life[s] = life;
    this.reflected[s] = 0;
    return s;
  }

  remove(slot: number): void {
    this.index.release(slot);
  }
}
