import { PALETTE } from './palette';

/**
 * Woodblock finish for baked sprites (GAME_DESIGN §7.3.1). Runs once per
 * sprite at bake time, never per frame:
 * - an ink keyline inside the silhouette edge, brush-tapered: thick on the
 *   shadow side (lower right), thin on the lit side (upper left);
 * - an optional textile pattern printed faintly inside the keyline.
 * The finish works on the baked pixels, so it applies to any shape and
 * stays consistent across rotations (the shadow side is fixed on screen).
 */
export type Motif = 'asanoha' | 'seigaiha' | 'kikko' | 'sakura';

export interface InkOptions {
  /** Keyline width on the lit side / shadow side, world units. */
  thin?: number;
  thick?: number;
  motif?: Motif;
  /** Pattern ink strength 0..1. */
  motifAlpha?: number;
}

const SAMPLES = 16;

export function inkFinish(canvas: HTMLCanvasElement, scale: number, opt: InkOptions): void {
  const w = canvas.width;
  const h = canvas.height;
  if (w < 8 || h < 8) return;
  const thin = (opt.thin ?? 0.7) * scale;
  const thick = (opt.thick ?? 1.8) * scale;

  // Interior = silhouette eroded by a lopsided disc (the brush).
  const inner = scratch(w, h);
  const ic = inner.getContext('2d') as CanvasRenderingContext2D;
  ic.drawImage(canvas, 0, 0);
  ic.globalCompositeOperation = 'destination-in';
  for (let i = 0; i < SAMPLES; i++) {
    const a = (i / SAMPLES) * Math.PI * 2;
    const ox = Math.cos(a);
    const oy = Math.sin(a);
    // Shadow side (light comes from the upper left): sample further when the
    // offset points up-left, so the edge facing lower right erodes more.
    const shade = Math.max(0, -(ox + oy) * 0.7071);
    const r = thin + (thick - thin) * shade;
    ic.drawImage(canvas, ox * r, oy * r);
  }
  ic.globalCompositeOperation = 'source-over';

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Pattern printed inside the keyline.
  if (opt.motif) {
    const tile = motifTile(opt.motif, scale);
    const pat = ic.createPattern(tile, 'repeat');
    if (pat) {
      ic.globalCompositeOperation = 'source-atop';
      ic.globalAlpha = opt.motifAlpha ?? 0.35;
      ic.fillStyle = pat;
      ic.fillRect(0, 0, w, h);
      ic.globalAlpha = 1;
      ic.globalCompositeOperation = 'source-over';
    }
  }
  // Keyline: the whole silhouette in ink, then the interior back on top.
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(inner, 0, 0);
  ctx.restore();
}

/** Sprites are baked rarely (on resize), so a fresh canvas each time is fine. */
function scratch(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const tiles = new Map<string, HTMLCanvasElement>();

/** Repeating textile motif tile, ink lines on transparent, device px. */
export function motifTile(
  motif: Motif,
  scale: number,
  color: string = PALETTE.ink,
): HTMLCanvasElement {
  const key = `${motif}@${scale.toFixed(3)}:${color}`;
  const cached = tiles.get(key);
  if (cached) return cached;
  const u = 6 * scale; // motif unit: 6 world units
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, 0.45 * scale);
  ctx.lineCap = 'round';
  switch (motif) {
    case 'asanoha': {
      // Hemp leaf: six-pointed stars on a triangular lattice.
      const tw = u * 2;
      const th = u * 2 * Math.sqrt(3);
      c.width = Math.ceil(tw);
      c.height = Math.ceil(th);
      ctx.lineWidth = Math.max(1, 0.35 * scale);
      const centres = [
        [0, 0],
        [tw, 0],
        [0, th],
        [tw, th],
        [tw / 2, th / 2],
      ];
      for (const [cx, cy] of centres) {
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
          ctx.beginPath();
          ctx.moveTo(cx as number, cy as number);
          ctx.lineTo(
            (cx as number) + Math.cos(a) * u * 1.15,
            (cy as number) + Math.sin(a) * u * 1.15,
          );
          ctx.stroke();
        }
      }
      break;
    }
    case 'seigaiha': {
      // Blue-ocean waves: overlapping concentric arcs.
      const r = u * 1.1;
      c.width = Math.ceil(r * 2);
      c.height = Math.ceil(r);
      const rows: [number, number][] = [
        [0, r],
        [r * 2, r],
        [r, r * 0.5],
        [r, r * 1.5],
        [-r, r * 1.5],
        [r * 3, r * 1.5],
      ];
      for (const [cx, cy] of rows) {
        for (let k = 1; k <= 3; k++) {
          ctx.beginPath();
          ctx.arc(cx, cy, (r * k) / 3.2, Math.PI, Math.PI * 2);
          ctx.stroke();
        }
      }
      break;
    }
    case 'kikko': {
      // Tortoiseshell hexagons.
      const s = u;
      const hw = s * Math.sqrt(3);
      c.width = Math.ceil(hw);
      c.height = Math.ceil(s * 3);
      const hex = (cx: number, cy: number): void => {
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
          const x = cx + Math.cos(a) * s * 0.92;
          const y = cy + Math.sin(a) * s * 0.92;
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      };
      hex(0, 0);
      hex(hw, 0);
      hex(hw / 2, s * 1.5);
      hex(0, s * 3);
      hex(hw, s * 3);
      break;
    }
    case 'sakura': {
      // Scattered five-petal blossoms, solid ink.
      c.width = Math.ceil(u * 3);
      c.height = Math.ceil(u * 3);
      const flower = (cx: number, cy: number, r: number, rot: number): void => {
        for (let k = 0; k < 5; k++) {
          const a = rot + (k / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.ellipse(
            cx + Math.cos(a) * r * 0.55,
            cy + Math.sin(a) * r * 0.55,
            r * 0.5,
            r * 0.32,
            a,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      };
      flower(u * 0.8, u * 0.9, u * 0.55, 0.3);
      flower(u * 2.2, u * 2.1, u * 0.42, 1.1);
      break;
    }
  }
  tiles.set(key, c);
  return c;
}
