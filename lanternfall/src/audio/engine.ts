/**
 * WebAudio graph (GAME_DESIGN §11): master → compressor → speakers, with
 * music and SFX buses. The context starts on the first user gesture, as
 * browser autoplay rules require. Every sound is synthesized: no files.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  music!: GainNode;
  sfx!: GainNode;
  private volumes = { master: 0.8, music: 0.6, sfx: 0.8 };
  private noise: AudioBuffer | null = null;
  private silence: HTMLAudioElement | null = null;

  /** Create/resume the context. Call from a user gesture handler. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor({ latencyHint: 'interactive' });
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master = ctx.createGain();
      this.music = ctx.createGain();
      this.sfx = ctx.createGain();
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.master.connect(comp).connect(ctx.destination);
      this.applyVolumes();
    }
    // iOS can leave the context 'interrupted' (not just 'suspended') after
    // the tab is hidden or the phone locks; resume from any stopped state.
    if (this.ctx.state !== 'running') void this.ctx.resume();
    this.keepAwake();
  }

  /**
   * iOS plays Web Audio on the ringer channel, so the silent switch mutes it.
   * Ask for the media ('playback') session where supported, and otherwise
   * keep a looping, generated silent <audio> element playing: an active
   * media element moves the page onto the playback session. Must run inside
   * a user gesture, which `unlock` callers guarantee.
   */
  private keepAwake(): void {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session && session.type !== 'playback') {
      try {
        session.type = 'playback';
      } catch {
        // Older WebKit: fall through to the silent element.
      }
    }
    if (this.silence) {
      if (this.silence.paused) void this.silence.play().catch(() => undefined);
      return;
    }
    const el = document.createElement('audio');
    el.src = silentWavUrl();
    el.loop = true;
    el.setAttribute('playsinline', '');
    el.setAttribute('aria-hidden', 'true');
    this.silence = el;
    void el.play().catch(() => undefined);
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  get now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  setVolumes(master: number, music: number, sfx: number): void {
    this.volumes = { master, music, sfx };
    this.applyVolumes();
  }

  /** Mute everything while the tab is hidden or the game is paused. */
  suspend(on: boolean): void {
    if (!this.ctx) return;
    if (on) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  /** One second of white noise, generated once and reused. */
  noiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (!this.noise) {
      const len = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      let seed = 0x9e3779b9;
      for (let i = 0; i < len; i++) {
        // xorshift: deterministic noise, no Math.random needed.
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        data[i] = ((seed >>> 0) / 4294967296) * 2 - 1;
      }
      this.noise = buf;
    }
    return this.noise;
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master, t, 0.05);
    this.music.gain.setTargetAtTime(this.volumes.music, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
  }
}

/** Half a second of generated silence as a WAV blob URL (no sample files). */
function silentWavUrl(): string {
  const rate = 8000;
  const samples = rate / 2;
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);
  const text = (o: number, str: string): void => {
    for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i));
  };
  text(0, 'RIFF');
  v.setUint32(4, 36 + samples, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true); // 8-bit
  text(36, 'data');
  v.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128); // 8-bit silence
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
