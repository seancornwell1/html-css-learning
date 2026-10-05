import type { EffectsQuality } from '../meta/save';
import type { FxParams } from './effects';
import { PALETTE } from './palette';
import { PostFx } from './postfx';

/** Device-pixel-ratio caps per effects quality (performance budget §12.3). */
const DPR_CAP: Record<EffectsQuality, number> = { off: 2, low: 1.25, high: 2 };

/**
 * Owns the visible canvas inside `stage`. With effects on, the world is drawn
 * to an offscreen 2D canvas and composited through WebGL2; with effects off
 * (or no WebGL2) the world is drawn straight to the visible canvas and the
 * few essential effects (inversion, speed lines) are done in Canvas2D.
 */
export class Display {
  /** Draw target for the world renderer. */
  ctx!: CanvasRenderingContext2D;
  width = 0;
  height = 0;
  /** CSS px → device px for the current quality. */
  dpr = 1;
  quality: EffectsQuality = 'off';
  /** Dynamic resolution multiplier (1, 0.85 or 0.7), set by `ResolutionGovernor`. */
  dynamicScale = 1;
  private visible!: HTMLCanvasElement;
  private target!: HTMLCanvasElement;
  private postfx: PostFx | null = null;

  constructor(private readonly stage: HTMLElement) {}

  /** (Re)create the canvases. Falls back to 'off' if WebGL2 fails. */
  setQuality(quality: EffectsQuality): EffectsQuality {
    const visible = document.createElement('canvas');
    visible.id = 'game';
    this.stage.replaceChildren(visible);
    this.visible = visible;
    this.postfx = null;
    this.quality = quality;
    if (quality !== 'off') {
      try {
        this.postfx = new PostFx(visible, quality === 'high');
        this.target = document.createElement('canvas');
        visible.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          // Simplest robust recovery: drop to Canvas2D for the session.
          queueMicrotask(() => this.setQuality('off'));
        });
      } catch (err) {
        console.warn('Post-FX unavailable, using Canvas2D only:', err);
        return this.setQuality('off');
      }
    } else {
      this.target = visible;
    }
    const ctx = this.target.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas2D unavailable');
    this.ctx = ctx;
    this.width = 0;
    this.height = 0;
    this.resize();
    return this.quality;
  }

  /** Match the backing store to the stage size. Returns true if it changed. */
  resize(): boolean {
    this.dpr = Math.max(
      0.5,
      Math.min(window.devicePixelRatio || 1, DPR_CAP[this.quality]) * this.dynamicScale,
    );
    const w = Math.max(1, Math.round(this.stage.clientWidth * this.dpr));
    const h = Math.max(1, Math.round(this.stage.clientHeight * this.dpr));
    if (w === this.width && h === this.height) return false;
    this.width = w;
    this.height = h;
    this.target.width = w;
    this.target.height = h;
    this.postfx?.resize(w, h);
    return true;
  }

  /** Finish the frame: run post-FX, or the Canvas2D fallback effects. */
  present(fx: FxParams): void {
    if (this.postfx) {
      // Halftone dot pitch: ~4 CSS px, so it reads the same on any screen.
      this.postfx.render(this.target, fx, 4 * this.dpr);
      return;
    }
    const { ctx, width, height } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (fx.impact > 0) drawSpeedLines(ctx, width, height, fx.impact, fx.time);
    if (fx.fade > 0) {
      ctx.globalAlpha = fx.fade * 0.3;
      ctx.fillStyle = PALETTE.ash;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    }
    if (fx.invert > 0) {
      // |bone − c| ≈ the bone↔ink swap for this two-tone palette.
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = PALETTE.bone;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}

function drawSpeedLines(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  strength: number,
  time: number,
): void {
  const cx = w / 2;
  const cy = h / 2;
  const outer = Math.hypot(w, h) / 2;
  ctx.strokeStyle = PALETTE.bone;
  ctx.globalAlpha = Math.min(1, strength) * 0.8;
  ctx.lineWidth = Math.max(1, w / 500);
  ctx.beginPath();
  const seed = Math.floor(time * 24);
  for (let i = 0; i < 48; i++) {
    // Cheap hash so the pattern flickers per frame like hand-drawn lines.
    const r = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
    if (r - Math.floor(r) < 0.6) continue;
    const a = (i / 48) * Math.PI * 2;
    ctx.moveTo(cx + Math.cos(a) * outer * 0.35, cy + Math.sin(a) * outer * 0.35);
    ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

const STEPS = [1, 0.85, 0.7] as const;

/**
 * Dynamic resolution (GAME_DESIGN §12.3): steps the render scale down when
 * frames stay slow and back up when there is headroom. Hysteresis and a
 * dwell time keep it from flapping (each change re-bakes sprites).
 */
export class ResolutionGovernor {
  private step = 0;
  private slowFor = 0;
  private fastFor = 0;

  /** Feed the smoothed frame time; returns true when the scale changed. */
  update(display: Display, frameMs: number, dt: number): boolean {
    if (frameMs > 22) {
      this.slowFor += dt;
      this.fastFor = 0;
    } else if (frameMs < 13) {
      this.fastFor += dt;
      this.slowFor = 0;
    } else {
      this.slowFor = 0;
      this.fastFor = 0;
    }
    let next = this.step;
    if (this.slowFor > 3 && this.step < STEPS.length - 1) next++;
    else if (this.fastFor > 8 && this.step > 0) next--;
    if (next === this.step) return false;
    this.step = next;
    this.slowFor = 0;
    this.fastFor = 0;
    display.dynamicScale = STEPS[next] ?? 1;
    return true;
  }
}
