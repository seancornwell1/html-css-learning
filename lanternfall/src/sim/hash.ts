/** Incremental FNV-1a hash over numbers (bit-exact for doubles). */
export class StateHasher {
  private h = 0x811c9dc5;
  private readonly f64 = new Float64Array(1);
  private readonly u32 = new Uint32Array(this.f64.buffer);

  u32v(v: number): this {
    this.mix(v >>> 0);
    return this;
  }

  num(v: number): this {
    this.f64[0] = v;
    this.mix(this.u32[0] ?? 0);
    this.mix(this.u32[1] ?? 0);
    return this;
  }

  digest(): number {
    return this.h >>> 0;
  }

  private mix(word: number): void {
    for (let i = 0; i < 4; i++) {
      this.h ^= (word >>> (i * 8)) & 0xff;
      this.h = Math.imul(this.h, 0x01000193);
    }
  }
}
