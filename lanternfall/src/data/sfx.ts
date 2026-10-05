/**
 * Sound effects as parameters, not files (GAME_DESIGN §11.2): a small
 * jsfxr-style description per effect, synthesized at play time.
 */
export type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';

export interface SfxDef {
  wave: Wave;
  /** Start and end frequency, Hz (end = slide target). */
  freq: number;
  freqEnd?: number;
  attack: number;
  decay: number;
  volume: number;
  /** Optional filter on the voice. */
  filter?: { type: BiquadFilterType; freq: number; q?: number };
  /** Extra layered partials as frequency ratios (bells, chords). */
  partials?: readonly number[];
  /** Random pitch spread, fraction (GAME_DESIGN: ±5%). */
  jitter?: number;
  /** At most this many voices of this effect at once. */
  maxVoices: number;
  /** Minimum gap between plays, ms. */
  minGapMs: number;
}

export const SFX = {
  hit: {
    wave: 'triangle',
    freq: 220,
    freqEnd: 110,
    attack: 0.002,
    decay: 0.06,
    volume: 0.12,
    jitter: 0.06,
    maxVoices: 6,
    minGapMs: 25,
  },
  kill: {
    wave: 'noise',
    freq: 1,
    attack: 0.001,
    decay: 0.09,
    volume: 0.1,
    filter: { type: 'highpass', freq: 2400 },
    maxVoices: 5,
    minGapMs: 30,
  },
  sweep: {
    wave: 'noise',
    freq: 1,
    attack: 0.02,
    decay: 0.16,
    volume: 0.16,
    filter: { type: 'bandpass', freq: 900, q: 1.2 },
    maxVoices: 2,
    minGapMs: 60,
  },
  shoot: {
    wave: 'square',
    freq: 880,
    freqEnd: 1320,
    attack: 0.002,
    decay: 0.05,
    volume: 0.05,
    jitter: 0.05,
    filter: { type: 'lowpass', freq: 3000 },
    maxVoices: 3,
    minGapMs: 50,
  },
  nova: {
    wave: 'sine',
    freq: 392,
    attack: 0.003,
    decay: 1.4,
    volume: 0.16,
    partials: [2.76, 5.4],
    maxVoices: 2,
    minGapMs: 200,
  },
  strike: {
    wave: 'noise',
    freq: 1,
    attack: 0.001,
    decay: 0.35,
    volume: 0.22,
    filter: { type: 'lowpass', freq: 1400 },
    maxVoices: 3,
    minGapMs: 60,
  },
  ember: {
    wave: 'sine',
    freq: 1760,
    freqEnd: 2093,
    attack: 0.002,
    decay: 0.07,
    volume: 0.035,
    jitter: 0.04,
    maxVoices: 3,
    minGapMs: 35,
  },
  pickup: {
    wave: 'triangle',
    freq: 587,
    freqEnd: 880,
    attack: 0.005,
    decay: 0.2,
    volume: 0.15,
    maxVoices: 2,
    minGapMs: 80,
  },
  level_up: {
    wave: 'triangle',
    freq: 587,
    attack: 0.005,
    decay: 0.6,
    volume: 0.14,
    partials: [1.26, 1.5, 2],
    maxVoices: 1,
    minGapMs: 150,
  },
  reliquary: {
    wave: 'sine',
    freq: 440,
    attack: 0.005,
    decay: 2,
    volume: 0.18,
    partials: [1.5, 2.25, 3.37],
    maxVoices: 1,
    minGapMs: 300,
  },
  evolution: {
    wave: 'sawtooth',
    freq: 220,
    freqEnd: 440,
    attack: 0.05,
    decay: 1.6,
    volume: 0.16,
    partials: [1.5, 2],
    filter: { type: 'lowpass', freq: 2200 },
    maxVoices: 1,
    minGapMs: 500,
  },
  player_hit: {
    wave: 'sawtooth',
    freq: 140,
    freqEnd: 60,
    attack: 0.002,
    decay: 0.22,
    volume: 0.24,
    filter: { type: 'lowpass', freq: 900 },
    maxVoices: 1,
    minGapMs: 120,
  },
  death: {
    wave: 'triangle',
    freq: 330,
    freqEnd: 55,
    attack: 0.01,
    decay: 2.2,
    volume: 0.22,
    maxVoices: 1,
    minGapMs: 1000,
  },
  dash: {
    wave: 'noise',
    freq: 1,
    attack: 0.01,
    decay: 0.18,
    volume: 0.15,
    filter: { type: 'bandpass', freq: 2200, q: 2 },
    maxVoices: 1,
    minGapMs: 100,
  },
  slam: {
    wave: 'sine',
    freq: 70,
    freqEnd: 35,
    attack: 0.002,
    decay: 0.7,
    volume: 0.4,
    maxVoices: 2,
    minGapMs: 150,
  },
  enemy_shot: {
    wave: 'sine',
    freq: 330,
    freqEnd: 220,
    attack: 0.01,
    decay: 0.18,
    volume: 0.07,
    maxVoices: 3,
    minGapMs: 60,
  },
  boss: {
    wave: 'sawtooth',
    freq: 55,
    attack: 0.3,
    decay: 3,
    volume: 0.25,
    partials: [1.5, 2.01],
    filter: { type: 'lowpass', freq: 600 },
    maxVoices: 1,
    minGapMs: 2000,
  },
  ui_move: {
    wave: 'sine',
    freq: 660,
    attack: 0.002,
    decay: 0.05,
    volume: 0.06,
    maxVoices: 2,
    minGapMs: 30,
  },
  ui_confirm: {
    wave: 'triangle',
    freq: 880,
    freqEnd: 1320,
    attack: 0.002,
    decay: 0.15,
    volume: 0.1,
    maxVoices: 1,
    minGapMs: 60,
  },
} as const satisfies Record<string, SfxDef>;

export type SfxId = keyof typeof SFX;
