import { motifTile } from './ink';
import { PALETTE, PRINT, withAlpha } from './palette';

/**
 * Title illustration (GAME_DESIGN §7.3.1): a woodblock night scene. An indigo
 * bokashi sky, a huge pale moon, stylised clouds, a torii on a rise, a
 * seigaiha sea, and a line of gold lanterns walking into the dark. Drawn to
 * fill any aspect ratio; the composition anchors to the bottom centre.
 */
export function drawTitleArt(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  // Sky.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, PRINT.ai);
  g.addColorStop(0.5, PRINT.aiDeep);
  g.addColorStop(1, PALETTE.ink);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const u = Math.min(w, h * 1.4) / 100; // composition unit
  const cx = w / 2;
  // Portrait screens put the menu low, so the shore rises to stay clear of it.
  const ground = h * (h > w ? 0.6 : w / h > 1.8 ? 0.62 : 0.78);

  // Moon with a soft rim.
  const mx = cx + u * 18;
  const my = h * (h > w ? 0.26 : 0.34);
  ctx.fillStyle = withAlpha(PALETTE.bone, 0.08);
  ctx.beginPath();
  ctx.arc(mx, my, u * 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = withAlpha(PALETTE.bone, 0.85);
  ctx.beginPath();
  ctx.arc(mx, my, u * 20, 0, Math.PI * 2);
  ctx.fill();
  // Cloud bands drifting across the moon.
  ctx.fillStyle = PRINT.aiDeep;
  const drift = (t * 1.5) % (w + u * 60);
  for (const [y, len, off] of [
    [my - u * 4, 46, 0],
    [my + u * 9, 34, 40],
    [h * 0.16, 28, 70],
  ] as const) {
    band(ctx, ((off * u + drift) % (w + len * u)) - len * u, y, len * u, u);
  }

  // Sea: seigaiha waves below the horizon.
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(0, ground, w, h - ground);
  const tile = motifTile('seigaiha', Math.max(1, u * 0.45), PALETTE.bone);
  const pat = ctx.createPattern(tile, 'repeat');
  if (pat) {
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.translate((t * 6) % tile.width, ground);
    ctx.fillStyle = pat;
    ctx.fillRect(-tile.width, 0, w + tile.width * 2, h - ground);
    ctx.restore();
  }
  // Moon road on the water.
  ctx.fillStyle = withAlpha(PALETTE.bone, 0.12);
  for (let i = 0; i < 7; i++) {
    const yy = ground + u * (3 + i * 3.2);
    const ww = u * (14 - i * 1.3);
    ctx.fillRect(mx - ww / 2, yy, ww, u * 0.7);
  }

  // A rise on the left with a torii, in solid ink.
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.moveTo(-u * 5, ground + u * 2);
  ctx.bezierCurveTo(
    cx - u * 40,
    ground - u * 14,
    cx - u * 14,
    ground - u * 10,
    cx + u * 4,
    ground + u * 2,
  );
  ctx.closePath();
  ctx.fill();
  torii(ctx, cx - u * 24, ground - u * 10.5, u);

  // The procession: gold lanterns walking along the shore, bobbing.
  for (let i = 0; i < 7; i++) {
    const x = cx - u * 4 + i * u * 6.5;
    const bob = Math.sin(t * 2 + i * 0.9) * u * 0.4;
    const y = ground - u * (2.2 + i * 0.05) + bob;
    const s = 1 - i * 0.07;
    walker(ctx, x, ground, u * s);
    lantern(ctx, x + u * 1.4 * s, y - u * 3 * s, u * s);
  }
}

function band(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, u: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + u * 1.6);
  ctx.arc(x + len * 0.15, y + u * 0.6, u * 1.4, Math.PI, 0);
  ctx.arc(x + len * 0.4, y, u * 2, Math.PI, 0);
  ctx.arc(x + len * 0.7, y + u * 0.8, u * 1.3, Math.PI, 0);
  ctx.lineTo(x + len, y + u * 1.6);
  ctx.closePath();
  ctx.fill();
}

function torii(ctx: CanvasRenderingContext2D, x: number, y: number, u: number): void {
  ctx.fillStyle = PALETTE.ink;
  // Kasagi (curved top beam).
  ctx.beginPath();
  ctx.moveTo(x - u * 7, y - u * 9.6);
  ctx.quadraticCurveTo(x, y - u * 8.6, x + u * 7, y - u * 9.6);
  ctx.lineTo(x + u * 6.4, y - u * 8.4);
  ctx.quadraticCurveTo(x, y - u * 7.6, x - u * 6.4, y - u * 8.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - u * 5.2, y - u * 7, u * 10.4, u * 0.8);
  ctx.fillRect(x - u * 4.2, y - u * 8.4, u * 0.9, u * 8.4);
  ctx.fillRect(x + u * 3.3, y - u * 8.4, u * 0.9, u * 8.4);
  // Thin bone rim on the moon side.
  ctx.fillStyle = withAlpha(PALETTE.bone, 0.25);
  ctx.fillRect(x + u * 4, y - u * 8.4, u * 0.2, u * 8.4);
}

function walker(ctx: CanvasRenderingContext2D, x: number, ground: number, u: number): void {
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.ellipse(x, ground - u * 5.2, u * 0.9, u * 1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - u * 0.9, ground - u * 4.3);
  ctx.lineTo(x + u * 1, ground - u * 4.3);
  ctx.lineTo(x + u * 1.6, ground);
  ctx.lineTo(x - u * 1.6, ground);
  ctx.closePath();
  ctx.fill();
}

function lantern(ctx: CanvasRenderingContext2D, x: number, y: number, u: number): void {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, u * 5);
  glow.addColorStop(0, withAlpha(PALETTE.gold, 0.45));
  glow.addColorStop(1, withAlpha(PALETTE.gold, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(x - u * 5, y - u * 5, u * 10, u * 10);
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.ellipse(x, y, u * 0.75, u * 1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = Math.max(1, u * 0.12);
  ctx.beginPath();
  ctx.moveTo(x, y - u * 1);
  ctx.lineTo(x - u * 0.8, y - u * 2.6);
  ctx.stroke();
}
