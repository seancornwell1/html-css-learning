import { Rng } from '../sim/rng';
import { PALETTE, withAlpha } from './palette';

/** World units per ground tile. */
export const GROUND_TILE = 512;

/**
 * Near-black ink-wash ground: soft blotches, a few cracks and grit, baked
 * once per device scale into a seamless tile (shapes wrap at the edges).
 */
export function bakeGround(scale: number): HTMLCanvasElement {
  const size = Math.ceil(GROUND_TILE * scale);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas2D unavailable');
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(0, 0, size, size);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const rng = new Rng(0x6e0d);
  const T = GROUND_TILE;
  // Draw a shape at every wrap offset so the tile is seamless.
  const wrapped = (x: number, y: number, r: number, draw: (x: number, y: number) => void): void => {
    for (const ox of [-T, 0, T]) {
      for (const oy of [-T, 0, T]) {
        const px = x + ox;
        const py = y + oy;
        if (px + r < 0 || py + r < 0 || px - r > T || py - r > T) continue;
        draw(px, py);
      }
    }
  };
  // Wash blotches.
  for (let i = 0; i < 26; i++) {
    const x = rng.range(0, T);
    const y = rng.range(0, T);
    const r = rng.range(40, 130);
    const a = rng.range(0.25, 0.7);
    wrapped(x, y, r, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, withAlpha(PALETTE.ink2, a));
      g.addColorStop(1, withAlpha(PALETTE.ink2, 0));
      ctx.fillStyle = g;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
  // Hairline cracks in the stone.
  ctx.strokeStyle = withAlpha(PALETTE.ash, 0.07);
  ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    let x = rng.range(0, T);
    let y = rng.range(0, T);
    let a = rng.range(0, Math.PI * 2);
    const pts: number[] = [x, y];
    const segs = rng.int(3, 7);
    for (let s = 0; s < segs; s++) {
      a += rng.range(-0.7, 0.7);
      x += Math.cos(a) * rng.range(8, 22);
      y += Math.sin(a) * rng.range(8, 22);
      pts.push(x, y);
    }
    wrapped(pts[0] as number, pts[1] as number, 160, (px, py) => {
      const dx = px - (pts[0] as number);
      const dy = py - (pts[1] as number);
      ctx.beginPath();
      for (let k = 0; k < pts.length; k += 2) {
        const qx = (pts[k] as number) + dx;
        const qy = (pts[k + 1] as number) + dy;
        if (k === 0) ctx.moveTo(qx, qy);
        else ctx.lineTo(qx, qy);
      }
      ctx.stroke();
    });
  }
  // Grit.
  ctx.fillStyle = withAlpha(PALETTE.ash, 0.12);
  for (let i = 0; i < 220; i++) {
    ctx.fillRect(rng.range(0, T), rng.range(0, T), 1.2, 1.2);
  }
  return canvas;
}
