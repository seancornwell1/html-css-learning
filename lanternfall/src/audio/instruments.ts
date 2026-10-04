import type { AudioEngine } from './engine';

/**
 * Synthesized instruments (GAME_DESIGN §11.1): a Karplus-Strong plucked
 * string (koto-like), taiko, a breathy flute, FM temple bells and drones.
 * Each schedules nodes at an exact AudioContext time and cleans up after.
 */
const ksCache = new Map<string, AudioBuffer>();

export function midiToHz(m: number): number {
  return 440 * 2 ** ((m - 69) / 12);
}

/** Karplus-Strong pluck baked to a buffer per pitch (cached). */
function pluckBuffer(ctx: BaseAudioContext, hz: number, seconds = 2): AudioBuffer {
  const key = `${Math.round(hz * 10)}`;
  const cached = ksCache.get(key);
  if (cached) return cached;
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(1, len, rate);
  const out = buf.getChannelData(0);
  const period = Math.max(2, Math.round(rate / hz));
  const ring = new Float32Array(period);
  let seed = Math.round(hz * 1000) | 1;
  for (let i = 0; i < period; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    ring[i] = ((seed >>> 0) / 4294967296) * 2 - 1;
  }
  // Slightly brighter decay than a guitar: koto-ish twang.
  const decay = 0.996;
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const a = ring[idx] as number;
    const b = ring[(idx + 1) % period] as number;
    const v = decay * 0.5 * (a + b);
    ring[idx] = v;
    out[i] = a;
    idx = (idx + 1) % period;
  }
  ksCache.set(key, buf);
  return buf;
}

export function pluck(
  eng: AudioEngine,
  dest: AudioNode,
  midi: number,
  time: number,
  vol = 0.3,
): void {
  const ctx = eng.ctx;
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = pluckBuffer(ctx, midiToHz(midi));
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 1.9);
  src.connect(g).connect(dest);
  src.start(time);
  src.stop(time + 2);
}

/** Taiko: a pitch-dropping sine body plus a short noise skin slap. */
export function taiko(
  eng: AudioEngine,
  dest: AudioNode,
  time: number,
  vol = 0.6,
  pitch = 90,
): void {
  const ctx = eng.ctx;
  if (!ctx) return;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(pitch * 1.8, time);
  osc.frequency.exponentialRampToValueAtTime(pitch * 0.55, time + 0.35);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.6);
  osc.connect(g).connect(dest);
  osc.start(time);
  osc.stop(time + 0.65);
  const noise = eng.noiseBuffer();
  if (!noise) return;
  const n = ctx.createBufferSource();
  n.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(vol * 0.5, time);
  ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
  n.connect(f).connect(ng).connect(dest);
  n.start(time);
  n.stop(time + 0.1);
}

/** Breathy flute: sine with vibrato plus band-passed breath noise. */
export function flute(
  eng: AudioEngine,
  dest: AudioNode,
  midi: number,
  time: number,
  length: number,
  vol = 0.18,
): void {
  const ctx = eng.ctx;
  if (!ctx) return;
  const hz = midiToHz(midi);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = hz;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.2;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = hz * 0.012;
  lfo.connect(lfoGain).connect(osc.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(vol, time + 0.12);
  g.gain.setValueAtTime(vol, time + Math.max(0.12, length - 0.2));
  g.gain.linearRampToValueAtTime(0.0001, time + length);
  osc.connect(g).connect(dest);
  osc.start(time);
  lfo.start(time);
  osc.stop(time + length + 0.05);
  lfo.stop(time + length + 0.05);
  const noise = eng.noiseBuffer();
  if (!noise) return;
  const n = ctx.createBufferSource();
  n.buffer = noise;
  n.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = hz * 2;
  bp.Q.value = 3;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, time);
  ng.gain.linearRampToValueAtTime(vol * 0.35, time + 0.08);
  ng.gain.linearRampToValueAtTime(0.0001, time + length);
  n.connect(bp).connect(ng).connect(dest);
  n.start(time);
  n.stop(time + length + 0.05);
}

/** FM temple bell: inharmonic modulator ratio, long decay. */
export function bell(
  eng: AudioEngine,
  dest: AudioNode,
  midi: number,
  time: number,
  vol = 0.15,
  decay = 3,
): void {
  const ctx = eng.ctx;
  if (!ctx) return;
  const hz = midiToHz(midi);
  const car = ctx.createOscillator();
  car.frequency.value = hz;
  const mod = ctx.createOscillator();
  mod.frequency.value = hz * 3.51;
  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(hz * 2.2, time);
  modGain.gain.exponentialRampToValueAtTime(hz * 0.05, time + decay);
  mod.connect(modGain).connect(car.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + decay);
  car.connect(g).connect(dest);
  car.start(time);
  mod.start(time);
  car.stop(time + decay + 0.05);
  mod.stop(time + decay + 0.05);
}

/** Sustained drone (two detuned saws, low-passed). Returns a stop function. */
export function drone(
  eng: AudioEngine,
  dest: AudioNode,
  midi: number,
  vol = 0.08,
): (when: number) => void {
  const ctx = eng.ctx;
  if (!ctx) return () => undefined;
  const t = ctx.currentTime;
  const hz = midiToHz(midi);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = hz * 3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 2);
  const oscs = [-6, 6].map((cents) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = hz;
    o.detune.value = cents;
    o.connect(lp);
    o.start(t);
    return o;
  });
  lp.connect(g).connect(dest);
  return (when: number) => {
    g.gain.cancelScheduledValues(when);
    g.gain.setValueAtTime(g.gain.value, when);
    g.gain.linearRampToValueAtTime(0.0001, when + 1.5);
    for (const o of oscs) o.stop(when + 1.6);
  };
}
