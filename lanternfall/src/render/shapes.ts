import { PALETTE } from './palette';

/**
 * More procedural silhouettes (GAME_DESIGN §7.3): original shapes drawn from
 * paths, in world units with the anchor at the origin. Weapons face +x.
 */
type Ctx = CanvasRenderingContext2D;

/** Bride of the Reservoir: tall veiled figure with a trailing veil. */
export function bride(ctx: Ctx, frame: number, fill: string): void {
  const sway = frame === 0 ? 0 : 2;
  ctx.fillStyle = fill;
  ctx.beginPath();
  // Veil: hood falling into a long trailing train behind (−x).
  ctx.moveTo(4, -30);
  ctx.quadraticCurveTo(14, -28, 12, -14);
  ctx.quadraticCurveTo(16, 4, 14, 22);
  ctx.lineTo(-6, 24);
  ctx.quadraticCurveTo(-22 - sway, 20, -34 - sway, 26);
  ctx.quadraticCurveTo(-24, 8 + sway, -12, -4);
  ctx.quadraticCurveTo(-10, -26, 4, -30);
  ctx.closePath();
  ctx.fill();
  // Long black hair spilling from the veil (ink).
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.moveTo(8, -20);
  ctx.quadraticCurveTo(10, -8, 6, 4);
  ctx.lineTo(3, 4);
  ctx.quadraticCurveTo(5, -8, 4, -20);
  ctx.closePath();
  ctx.fill();
}

/** Moth with two flap frames. */
export function moth(ctx: Ctx, frame: number): void {
  const spread = frame === 0 ? 1 : 0.45;
  ctx.fillStyle = PALETTE.bone;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 4 * spread, -2, 5 * spread + 1, 4, side * 0.5, 0, Math.PI * 2);
    ctx.ellipse(side * 3 * spread, 3, 3.5 * spread + 0.8, 2.8, -side * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(-0.8, -4, 1.6, 8);
}

export function kunai(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(1, -2.6);
  ctx.lineTo(-3, -1);
  ctx.lineTo(-3, 1);
  ctx.lineTo(1, 2.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-8, -0.8, 5, 1.6);
  ctx.strokeStyle = PALETTE.bone;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(-9, 0, 1.8, 0, Math.PI * 2);
  ctx.stroke();
}

export function crane(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath();
  ctx.moveTo(10, -1);
  ctx.lineTo(2, -2);
  ctx.lineTo(-2, -10);
  ctx.lineTo(-3, -2);
  ctx.lineTo(-10, 0);
  ctx.lineTo(-3, 2);
  ctx.lineTo(-2, 10);
  ctx.lineTo(2, 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-3, -2);
  ctx.lineTo(2, 2);
  ctx.stroke();
}

export function chime(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(0, -3);
  ctx.lineTo(-7, -1.5);
  ctx.lineTo(-7, 1.5);
  ctx.lineTo(0, 3);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-7, 0, 2.6, 0, Math.PI * 2);
  ctx.arc(7, 0, 2, 0, Math.PI * 2);
  ctx.fill();
}

export function koi(ctx: Ctx, scale = 1): void {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.quadraticCurveTo(6, -5, -4, -3);
  ctx.lineTo(-10, -6);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-10, 6);
  ctx.lineTo(-4, 3);
  ctx.quadraticCurveTo(6, 5, 10, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.arc(6, -1, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Harvest Moon crescent wave. */
export function crescent(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath();
  ctx.arc(-14, 0, 30, -1.1, 1.1);
  ctx.arc(-24, 0, 26, 1.0, -1.0, true);
  ctx.closePath();
  ctx.fill();
}

/** Dragon Gate: a great fish-dragon. */
export function dragon(ctx: Ctx): void {
  koi(ctx, 3.4);
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(30, -6);
  ctx.quadraticCurveTo(44, -16, 50, -6);
  ctx.moveTo(30, 6);
  ctx.quadraticCurveTo(44, 16, 50, 6);
  ctx.stroke();
}

/** Turret / small player shot: a gold spark. */
export function shot(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Ghost flame (fox fire, burning embers). Frames flicker. */
export function flame(ctx: Ctx, frame: number): void {
  const lean = [0, 2, -1.5][frame] ?? 0;
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.quadraticCurveTo(-8, 4, -5, -4);
  ctx.quadraticCurveTo(-2, -2, lean, -14);
  ctx.quadraticCurveTo(3, -4, 6, -3);
  ctx.quadraticCurveTo(8, 5, 0, 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.ellipse(0, 3, 2.4, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Incense smoke puff (drawn translucent). */
export function smoke(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.ash;
  for (const [x, y, r] of [
    [0, 0, 9],
    [-7, 3, 6],
    [7, 2, 7],
    [2, -6, 6],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Reliquary: a gold shrine box with a bone roof. */
export function reliquary(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(-8, -4, 16, 11);
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath();
  ctx.moveTo(-11, -4);
  ctx.lineTo(0, -11);
  ctx.lineTo(11, -4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(-1.2, -2, 2.4, 7);
}

export function onigiri(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.quadraticCurveTo(9, 6, 7, 7);
  ctx.lineTo(-7, 7);
  ctx.quadraticCurveTo(-9, 6, 0, -8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(-4, 1, 8, 6);
}

export function coin(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(-1.6, -1.6, 3.2, 3.2);
}

/** Stone watchfire lantern (tōrō-like) with a gold flame. */
export function stoneLantern(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.bone;
  ctx.fillRect(-7, 8, 14, 4);
  ctx.fillRect(-2.5, -2, 5, 10);
  ctx.fillRect(-6, -9, 12, 7);
  ctx.beginPath();
  ctx.moveTo(-10, -9);
  ctx.lineTo(0, -16);
  ctx.lineTo(10, -9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(-3, -7.5, 6, 4);
}

/** Oil-paper parasol seen from above. */
export function parasol(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
  }
  ctx.stroke();
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(0, 0, 2, 0, Math.PI * 2);
  ctx.fill();
}
