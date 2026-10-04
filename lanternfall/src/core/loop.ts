import { DT } from '../sim/constants';

export interface LoopCallbacks {
  /** Advance the simulation by exactly one fixed tick. */
  step(): void;
  /** Draw; `alpha` in [0,1) is how far we are between the last tick and the next. */
  render(alpha: number): void;
}

/** Longest frame we will try to catch up on (prevents the spiral of death). */
const MAX_FRAME = 0.25;
/** Absorbs float drift so e.g. 0.25 s at 100 Hz is exactly 25 ticks. */
const EPSILON = 1e-9;

/**
 * Fixed-timestep accumulator loop. `advance` is pure and testable;
 * `start` drives it from requestAnimationFrame.
 */
export class FixedStepLoop {
  private accumulator = 0;
  private last = -1;
  private rafId = 0;
  private running = false;

  constructor(
    private readonly cb: LoopCallbacks,
    private readonly stepSeconds = DT,
  ) {}

  /** Feed `frameSeconds` of wall time; returns the number of ticks run. */
  advance(frameSeconds: number): number {
    this.accumulator += Math.min(Math.max(frameSeconds, 0), MAX_FRAME);
    let steps = 0;
    while (this.accumulator >= this.stepSeconds - EPSILON) {
      this.cb.step();
      this.accumulator -= this.stepSeconds;
      steps++;
    }
    this.cb.render(Math.max(0, this.accumulator) / this.stepSeconds);
    return steps;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = -1;
    const frame = (now: number): void => {
      if (!this.running) return;
      const seconds = this.last < 0 ? 0 : (now - this.last) / 1000;
      this.last = now;
      this.advance(seconds);
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}
