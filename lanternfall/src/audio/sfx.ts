import { SFX, type SfxDef, type SfxId } from '../data/sfx';
import { ENEMIES } from '../data/enemies';
import type { SimEvent } from '../sim/events';
import type { AudioEngine } from './engine';

/** Plays synthesized SFX with per-effect voice limits (GAME_DESIGN §11.2). */
export class SfxPlayer {
  private readonly lastPlay = new Map<SfxId, number>();
  private readonly voices = new Map<SfxId, number>();
  /** Small, deterministic jitter source (presentation only). */
  private seed = 0x1234567;

  constructor(private readonly eng: AudioEngine) {}

  play(id: SfxId, gain = 1): void {
    const ctx = this.eng.ctx;
    if (!ctx || !this.eng.ready) return;
    const def: SfxDef = SFX[id];
    const nowMs = ctx.currentTime * 1000;
    if (nowMs - (this.lastPlay.get(id) ?? -1e9) < def.minGapMs) return;
    if ((this.voices.get(id) ?? 0) >= def.maxVoices) return;
    this.lastPlay.set(id, nowMs);
    this.voices.set(id, (this.voices.get(id) ?? 0) + 1);

    const t = ctx.currentTime;
    const jitter = 1 + (def.jitter ?? 0.05) * (this.rand() * 2 - 1);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(def.volume * gain, t + def.attack);
    out.gain.exponentialRampToValueAtTime(0.0001, t + def.attack + def.decay);
    let head: AudioNode = out;
    if (def.filter) {
      const f = ctx.createBiquadFilter();
      f.type = def.filter.type;
      f.frequency.value = def.filter.freq;
      if (def.filter.q !== undefined) f.Q.value = def.filter.q;
      f.connect(out);
      head = f;
    }
    out.connect(this.eng.sfx);
    const end = t + def.attack + def.decay + 0.05;
    const ratios = [1, ...(def.partials ?? [])];
    let done = 0;
    for (const ratio of ratios) {
      const src = this.voice(def, ratio * jitter, t, end);
      if (!src) continue;
      src.connect(head);
      src.onended = () => {
        if (++done === ratios.length)
          this.voices.set(id, Math.max(0, (this.voices.get(id) ?? 1) - 1));
      };
    }
  }

  private voice(
    def: SfxDef,
    ratio: number,
    t: number,
    end: number,
  ): AudioScheduledSourceNode | null {
    const ctx = this.eng.ctx;
    if (!ctx) return null;
    if (def.wave === 'noise') {
      const buf = this.eng.noiseBuffer();
      if (!buf) return null;
      const n = ctx.createBufferSource();
      n.buffer = buf;
      n.loop = true;
      n.start(t, this.rand() * 0.5);
      n.stop(end);
      return n;
    }
    const o = ctx.createOscillator();
    o.type = def.wave;
    o.frequency.setValueAtTime(def.freq * ratio, t);
    if (def.freqEnd) o.frequency.exponentialRampToValueAtTime(def.freqEnd * ratio, end - 0.05);
    o.start(t);
    o.stop(end);
    return o;
  }

  private rand(): number {
    this.seed ^= this.seed << 13;
    this.seed ^= this.seed >>> 17;
    this.seed ^= this.seed << 5;
    return (this.seed >>> 0) / 4294967296;
  }

  /** Map sim events to sounds. */
  onEvent(e: SimEvent): void {
    switch (e.type) {
      case 'enemy_hit':
        this.play('hit');
        break;
      case 'enemy_killed':
        this.play(ENEMIES[e.kind]?.elite || ENEMIES[e.kind]?.boss ? 'slam' : 'kill');
        break;
      case 'sweep':
      case 'whip':
        this.play('sweep');
        break;
      case 'projectile_fired':
        this.play('shoot');
        break;
      case 'nova':
        this.play('nova');
        break;
      case 'strike':
        this.play('strike');
        break;
      case 'ember_collected':
        this.play('ember');
        break;
      case 'pickup':
        this.play('pickup');
        break;
      case 'level_up':
        this.play('level_up');
        break;
      case 'reliquary':
        this.play('reliquary');
        break;
      case 'evolution':
        this.play('evolution');
        break;
      case 'player_hit':
        this.play('player_hit');
        break;
      case 'player_died':
        this.play('death');
        break;
      case 'dash':
        this.play('dash');
        break;
      case 'slam':
        this.play('slam');
        break;
      case 'boss':
        this.play('boss');
        break;
      default:
        break;
    }
  }
}
