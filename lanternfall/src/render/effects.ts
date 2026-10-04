/**
 * Presentation-only screen effects (GAME_DESIGN §7.4). Nothing here touches
 * the sim. Full-screen flashes are always capped at 3 Hz; with "Reduce
 * flashing" inversions become a soft fade and impact frames lose the flash.
 */
export const MAX_FLASH_HZ = 3;

export interface FxParams {
  /** 0..1 bone↔ink inversion. */
  invert: number;
  /** 0..1 soft ash fade (the reduced-flashing substitute). */
  fade: number;
  /** 0..1 chromatic aberration strength. */
  ca: number;
  /** 0..1 radial speed lines. */
  impact: number;
  /** Seconds, for grain animation. */
  time: number;
}

/** Trauma-based camera shake: offset grows with trauma², decays linearly. */
export class Shake {
  trauma = 0;
  /** User setting, 0..1. */
  scale = 1;
  private t = 0;
  x = 0;
  y = 0;

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt: number, maxOffset = 14): void {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const k = this.trauma * this.trauma * maxOffset * this.scale;
    // Sum of incommensurate sines: smooth, non-repeating, deterministic.
    this.x = k * (Math.sin(this.t * 53.1) * 0.6 + Math.sin(this.t * 31.7 + 1.3) * 0.4);
    this.y = k * (Math.sin(this.t * 47.3 + 2.1) * 0.6 + Math.sin(this.t * 27.9 + 0.4) * 0.4);
  }

  reset(): void {
    this.trauma = 0;
    this.x = 0;
    this.y = 0;
  }
}

export class ScreenFx {
  reduceFlashing = false;
  private invertLeft = 0;
  private fadeLeft = 0;
  private fadeTotal = 0.001;
  private ca = 0;
  private impact = 0;
  private time = 0;
  /** Seconds since the last full-screen flash (inversion or fade). */
  private sinceFlash = 1;

  /** Brief full-screen inversion (or soft fade). Dropped if over 3 Hz. */
  flash(seconds: number): boolean {
    if (this.sinceFlash < 1 / MAX_FLASH_HZ) return false;
    this.sinceFlash = 0;
    if (this.reduceFlashing) {
      this.fadeTotal = Math.max(0.2, seconds * 3);
      this.fadeLeft = this.fadeTotal;
    } else {
      this.invertLeft = Math.max(this.invertLeft, seconds);
    }
    return true;
  }

  aberration(amount: number): void {
    this.ca = Math.min(1, this.ca + amount);
  }

  /** Anime impact frame: a 2–3 frame inversion plus radial speed lines. */
  impactFrame(strength = 1): void {
    this.flash(0.05);
    this.impact = Math.max(this.impact, this.reduceFlashing ? strength * 0.4 : strength);
    this.aberration(0.6 * strength);
  }

  update(dt: number): void {
    this.time += dt;
    this.sinceFlash += dt;
    this.invertLeft = Math.max(0, this.invertLeft - dt);
    this.fadeLeft = Math.max(0, this.fadeLeft - dt);
    this.ca = Math.max(0, this.ca - dt * 6);
    this.impact = Math.max(0, this.impact - dt * 3.2);
  }

  params(out: FxParams): FxParams {
    out.invert = this.invertLeft > 0 ? 1 : 0;
    out.fade = this.fadeLeft / this.fadeTotal;
    out.ca = this.ca;
    out.impact = this.impact;
    out.time = this.time;
    return out;
  }

  reset(): void {
    this.invertLeft = 0;
    this.fadeLeft = 0;
    this.ca = 0;
    this.impact = 0;
  }
}

/** Freezes the presentation (and sim stepping) for a few frames on big hits. */
export class HitStop {
  private until = 0;

  trigger(ms: number, now: number): void {
    this.until = Math.max(this.until, now + ms);
  }

  active(now: number): boolean {
    return now < this.until;
  }

  reset(): void {
    this.until = 0;
  }
}

export const MAX_DECALS = 200;

/**
 * Kill splatters (ring buffer). Fresh splats are bone, decay to ash, then
 * fade out; the oldest is overwritten when full.
 */
export class Decals {
  readonly x = new Float32Array(MAX_DECALS);
  readonly y = new Float32Array(MAX_DECALS);
  readonly age = new Float32Array(MAX_DECALS).fill(Infinity);
  readonly variant = new Uint8Array(MAX_DECALS);
  readonly size = new Float32Array(MAX_DECALS);
  private next = 0;
  private counter = 0;

  static readonly FRESH = 0.12;
  static readonly LIFE = 9;

  add(x: number, y: number, size: number, variants: number): void {
    const i = this.next;
    this.x[i] = x;
    this.y[i] = y;
    this.size[i] = size;
    this.age[i] = 0;
    this.variant[i] = this.counter++ % variants;
    this.next = (i + 1) % MAX_DECALS;
  }

  update(dt: number): void {
    for (let i = 0; i < MAX_DECALS; i++) this.age[i] = (this.age[i] as number) + dt;
  }

  reset(): void {
    this.age.fill(Infinity);
  }
}
