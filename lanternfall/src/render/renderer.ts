import { ENEMIES } from '../data/enemies';
import type { SimEvent } from '../sim/events';
import type { Sim } from '../sim/sim';
import { Camera } from './camera';
import { PALETTE, withAlpha } from './palette';

const MAX_DPR = 2;
const GRID = 64;

/**
 * Canvas2D world renderer. Placeholder shapes for M0; the procedural
 * silhouette pipeline and WebGL post-FX arrive in M2.
 */
export class Renderer {
  readonly camera = new Camera();
  private readonly ctx: CanvasRenderingContext2D;
  /** Seconds of player-hit inversion remaining (presentation only). */
  private hitFlash = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas2D unavailable');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.camera.fit(w, h);
  }

  onEvent(e: SimEvent): void {
    if (e.type === 'player_hit') this.hitFlash = 0.08;
  }

  draw(sim: Sim, frameSeconds: number): void {
    const { ctx, canvas, camera } = this;
    const inverted = this.hitFlash > 0;
    this.hitFlash = Math.max(0, this.hitFlash - frameSeconds);
    const bg = inverted ? PALETTE.bone : PALETTE.ink;
    const fg = inverted ? PALETTE.ink : PALETTE.bone;

    camera.x = sim.player.x;
    camera.y = sim.player.y;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // World space: origin at screen centre, 1 unit = camera.scale px.
    ctx.setTransform(
      camera.scale,
      0,
      0,
      camera.scale,
      canvas.width / 2 - camera.x * camera.scale,
      canvas.height / 2 - camera.y * camera.scale,
    );

    this.drawGround(inverted);
    this.drawLight(sim);

    ctx.fillStyle = fg;
    const e = sim.enemies;
    for (let i = 0; i < e.count; i++) {
      const s = e.slots[i] as number;
      const def = ENEMIES[e.kind[s] as number];
      if (!def) continue;
      ctx.beginPath();
      ctx.ellipse(
        e.x[s] as number,
        e.y[s] as number,
        def.radius * 0.8,
        def.radius,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    const p = sim.player;
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    // The lantern: the one gold thing on screen.
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(p.x + p.faceX * 16, p.y + p.faceY * 16, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawGround(inverted: boolean): void {
    const { ctx, canvas, camera } = this;
    const halfW = canvas.width / 2 / camera.scale;
    const halfH = canvas.height / 2 / camera.scale;
    const x0 = Math.floor((camera.x - halfW) / GRID) * GRID;
    const y0 = Math.floor((camera.y - halfH) / GRID) * GRID;
    ctx.fillStyle = inverted ? PALETTE.ash : PALETTE.ink2;
    for (let x = x0; x <= camera.x + halfW; x += GRID) {
      for (let y = y0; y <= camera.y + halfH; y += GRID) {
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
    }
  }

  private drawLight(sim: Sim): void {
    const { ctx } = this;
    const p = sim.player;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 140);
    g.addColorStop(0, withAlpha(PALETTE.gold, 0.16));
    g.addColorStop(1, withAlpha(PALETTE.gold, 0));
    ctx.fillStyle = g;
    ctx.fillRect(p.x - 140, p.y - 140, 280, 280);
  }
}
