import { Rng } from '../sim/rng';
import type { AudioEngine } from './engine';
import { bell, drone, flute, pluck, taiko } from './instruments';

/**
 * Procedural music (GAME_DESIGN §11.1): a seeded generative sequencer with a
 * 25 ms lookahead scheduler. Each track is a function that schedules one
 * 16th-note step; the run track layers by `intensity` (0..1).
 */
export type TrackId = 'paper_moon' | 'night_procession' | 'mother' | 'festival' | 'dawn' | 'ashes';

/** Scales as semitone offsets (GAME_DESIGN: in / yo / hirajoshi). */
const IN = [0, 1, 5, 7, 8]; // miyako-bushi
const YO = [0, 2, 5, 7, 9];
const HIRAJOSHI = [0, 2, 3, 7, 8];

interface Track {
  bpm: number;
  root: number;
  scale: number[];
  droneMidi: number | null;
  /** Schedule step `step` (16ths) at `time`. */
  step(ctx: StepCtx, step: number, time: number): void;
}

interface StepCtx {
  eng: AudioEngine;
  out: AudioNode;
  rng: Rng;
  intensity: number;
  note(degree: number, octave?: number): number;
  stepLen: number;
}

const TRACKS: Record<TrackId, Track> = {
  paper_moon: {
    bpm: 64,
    root: 50,
    scale: IN,
    droneMidi: 38,
    step(c, step, time) {
      if (step % 4 === 0 && c.rng.chance(0.55)) {
        pluck(c.eng, c.out, c.note(c.rng.int(0, 7)), time, 0.22);
      }
      if (step % 64 === 0) bell(c.eng, c.out, c.note(0, 2), time, 0.08, 5);
    },
  },
  night_procession: {
    bpm: 84,
    root: 50,
    scale: HIRAJOSHI,
    droneMidi: 38,
    step(c, step, time) {
      const i = c.intensity;
      // Layer 1: koto ostinato.
      if (i > 0.1 && step % 4 === 0) {
        const pattern = [0, 2, 4, 2, 3, 2, 1, 2];
        pluck(
          c.eng,
          c.out,
          c.note(pattern[(step / 4) % pattern.length] ?? 0),
          time,
          0.16 + 0.1 * i,
        );
      }
      // Layer 2: taiko pulse.
      if (i > 0.35) {
        if (step % 8 === 0) taiko(c.eng, c.out, time, 0.45);
        if (step % 16 === 14 && c.rng.chance(0.6)) taiko(c.eng, c.out, time, 0.25, 130);
      }
      // Layer 3: flute lead, a slow random walk.
      if (i > 0.6 && step % 8 === 0 && c.rng.chance(0.7)) {
        flute(c.eng, c.out, c.note(c.rng.int(3, 9), 1), time, c.stepLen * 7, 0.13);
      }
      if (step % 128 === 0) bell(c.eng, c.out, c.note(0, 2), time, 0.06, 6);
    },
  },
  mother: {
    bpm: 132,
    root: 49,
    scale: IN,
    droneMidi: 37,
    step(c, step, time) {
      if (step % 2 === 0)
        taiko(c.eng, c.out, time, step % 8 === 0 ? 0.6 : 0.3, step % 8 === 0 ? 80 : 120);
      if (step % 8 === 4) pluck(c.eng, c.out, c.note(c.rng.pick([0, 1, 5])), time, 0.25);
      if (step % 32 === 0) {
        bell(c.eng, c.out, c.note(0, 2), time, 0.09, 2.5);
        bell(c.eng, c.out, c.note(1, 2), time, 0.07, 2.5); // dissonant minor second
      }
    },
  },
  festival: {
    bpm: 168,
    root: 52,
    scale: YO,
    droneMidi: null,
    step(c, step, time) {
      if (step % 2 === 0) taiko(c.eng, c.out, time, 0.25, 170); // shime-daiko
      if (step % 4 === 0) pluck(c.eng, c.out, c.note((step / 4) % 7), time, 0.18);
    },
  },
  dawn: {
    bpm: 72,
    root: 52,
    scale: YO,
    droneMidi: 40,
    step(c, step, time) {
      if (step % 2 === 0)
        pluck(c.eng, c.out, c.note([0, 2, 4, 5, 7, 5, 4, 2][(step / 2) % 8] ?? 0), time, 0.18);
      if (step % 16 === 0)
        flute(c.eng, c.out, c.note(c.rng.pick([4, 5, 7]), 1), time, c.stepLen * 14, 0.12);
    },
  },
  ashes: {
    bpm: 52,
    root: 45,
    scale: IN,
    droneMidi: 33,
    step(c, step, time) {
      if (step % 8 === 0 && step < 64) pluck(c.eng, c.out, c.note(9 - step / 8), time, 0.2);
    },
  },
};

const LOOKAHEAD = 0.12;
const TICK_MS = 25;

export class MusicPlayer {
  private track: TrackId | null = null;
  private bus: GainNode | null = null;
  private stopDrone: ((when: number) => void) | null = null;
  private nextTime = 0;
  private step = 0;
  private timer = 0;
  private rng = new Rng(1);
  intensity = 0;

  constructor(private readonly eng: AudioEngine) {}

  get current(): TrackId | null {
    return this.track;
  }

  /** Crossfade to `id` (no-op if already playing). */
  play(id: TrackId): void {
    const ctx = this.eng.ctx;
    if (!ctx || this.track === id) return;
    this.stop();
    this.track = id;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);
    bus.connect(this.eng.music);
    this.bus = bus;
    const def = TRACKS[id];
    this.stopDrone = def.droneMidi !== null ? drone(this.eng, bus, def.droneMidi) : null;
    this.rng = new Rng(id.length * 7919 + 13);
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
  }

  stop(): void {
    const ctx = this.eng.ctx;
    window.clearInterval(this.timer);
    if (ctx && this.bus) {
      const bus = this.bus;
      const t = ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0.0001, t + 1.2);
      this.stopDrone?.(t);
      window.setTimeout(() => bus.disconnect(), 1500);
    }
    this.bus = null;
    this.track = null;
  }

  private schedule(): void {
    const ctx = this.eng.ctx;
    if (!ctx || !this.track || !this.bus) return;
    const def = TRACKS[this.track];
    const stepLen = 60 / def.bpm / 4;
    const c: StepCtx = {
      eng: this.eng,
      out: this.bus,
      rng: this.rng,
      intensity: this.intensity,
      stepLen,
      note: (degree, octave = 0) => {
        const n = def.scale.length;
        const oct = Math.floor(degree / n) + octave;
        const idx = ((degree % n) + n) % n;
        return def.root + 12 * oct + (def.scale[idx] ?? 0);
      },
    };
    // After a stall (tab hidden), skip ahead instead of bursting.
    if (this.nextTime < ctx.currentTime - 0.5) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      def.step(c, this.step, this.nextTime);
      this.step++;
      this.nextTime += stepLen;
    }
  }
}
