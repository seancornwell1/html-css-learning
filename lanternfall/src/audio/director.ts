import { ENEMIES } from '../data/enemies';
import type { SimEvent } from '../sim/events';
import type { Sim } from '../sim/sim';
import { AudioEngine } from './engine';
import { MusicPlayer, type TrackId } from './music';
import { SfxPlayer } from './sfx';

const MOTHER = ENEMIES.findIndex((d) => d.behaviour === 'mother');

/**
 * Picks music from game state and routes sim events to SFX. Presentation
 * only: it reads the sim, never writes it (CLAUDE.md rule 2).
 */
export class AudioDirector {
  readonly engine = new AudioEngine();
  readonly music = new MusicPlayer(this.engine);
  readonly sfx = new SfxPlayer(this.engine);
  /** Menu track while no run is live (select screen, notice). */
  menu = true;

  /** Call from any user gesture; browsers block audio until one happens. */
  unlock(): void {
    this.engine.unlock();
  }

  setVolumes(master: number, music: number, sfx: number): void {
    this.engine.setVolumes(master, music, sfx);
  }

  onEvent(e: SimEvent): void {
    this.sfx.onEvent(e);
  }

  /** Once per rendered frame. */
  update(sim: Sim): void {
    if (!this.engine.ctx) return;
    this.music.play(this.pickTrack(sim));
    // Intensity follows the crowd and the clock, smoothed so layers don't flap.
    const crowd = Math.min(1, sim.enemies.count / 260);
    const clock = Math.min(1, sim.time / 600);
    const target = sim.longNight ? 1 : Math.max(crowd, clock * 0.8);
    this.music.intensity += (target - this.music.intensity) * 0.02;
  }

  private pickTrack(sim: Sim): TrackId {
    if (this.menu) return 'paper_moon';
    if (sim.status === 'won') return 'dawn';
    if (sim.status === 'dead') return 'ashes';
    if (MOTHER >= 0 && this.alive(sim, MOTHER)) return 'mother';
    if (sim.frenzy > 0) return 'festival';
    return 'night_procession';
  }

  private alive(sim: Sim, kind: number): boolean {
    const e = sim.enemies;
    for (let i = 0; i < e.count; i++) {
      if (e.kind[e.slots[i] as number] === kind) return true;
    }
    return false;
  }
}
