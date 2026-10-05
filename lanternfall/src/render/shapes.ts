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
  // Brushed folds in the veil, like a print's key block.
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.9;
  for (const [x0, y0, cx, cy, x1, y1] of [
    [-4, -12, -14, 4, -22 - sway, 20],
    [2, -6, -2, 8, -6, 22],
    [10, -10, 13, 6, 10, 21],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.stroke();
  }
  // Hood brim over a hidden face: only a thin, too-wide smile shows.
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-2, -22);
  ctx.quadraticCurveTo(6, -26, 13, -19);
  ctx.stroke();
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(6, -13);
  ctx.quadraticCurveTo(9, -11, 12, -14);
  ctx.stroke();
  // Long black hair spilling from the veil (rimmed so it reads at night).
  ctx.fillStyle = PALETTE.ink;
  ctx.strokeStyle = fill;
  ctx.beginPath();
  ctx.moveTo(8, -20);
  ctx.quadraticCurveTo(10, -8, 6, 4);
  ctx.lineTo(3, 4);
  ctx.quadraticCurveTo(5, -8, 4, -20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
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

// ---- M5 roster ---------------------------------------------------------------

/** Drowned: bloated, hunched, dripping. Frames sway. */
export function drowned(ctx: Ctx, frame: number, fill: string): void {
  const sway = frame === 0 ? 0 : 1.5;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(3 + sway, -12, 6.5, 6, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-10, -6);
  ctx.quadraticCurveTo(4 + sway, -14, 14 + sway, -4);
  ctx.quadraticCurveTo(18, 10, 10, 16);
  ctx.lineTo(-12, 16);
  ctx.quadraticCurveTo(-18, 4, -10, -6);
  ctx.closePath();
  ctx.fill();
  // Drips.
  for (const [x, len] of [
    [-8, 5],
    [0, 7],
    [8, 4],
  ] as const) {
    ctx.fillRect(x - 0.8, 16, 1.6, len + sway);
  }
  // Sunken eyes and a slack mouth.
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.ellipse(6 + sway, -13.5, 1.3, 1.8, 0, 0, Math.PI * 2);
  ctx.ellipse(6.5 + sway, -8.6, 1.2, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Wet hair plastered over the skull and down the back, in rimmed strands.
  ctx.strokeStyle = fill;
  ctx.lineCap = 'round';
  for (const [x0, x1, len] of [
    [-2, -6, 14],
    [1, -2, 18],
    [4, 2, 10],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x0 + sway, -18);
    ctx.quadraticCurveTo(x1 - 2, -10, x1, -18 + len);
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = fill;
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = PALETTE.ink;
    ctx.stroke();
  }
}

/** Carrion crow, flying toward +x. Frames flap. */
export function crow(ctx: Ctx, frame: number, fill: string): void {
  const up = frame === 0 ? -1 : 0.4;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8, -1);
  ctx.lineTo(13, 0);
  ctx.lineTo(8, 1.5);
  ctx.closePath();
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.quadraticCurveTo(-2, side * 10 * (up < 0 ? 1.1 : 0.6), -8, side * 12 * (up < 0 ? 1 : 0.5));
    ctx.lineTo(-4, side * 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(-7, -2);
  ctx.lineTo(-13, 0);
  ctx.lineTo(-7, 2);
  ctx.closePath();
  ctx.fill();
}

/** Long-Neck: a robed woman whose neck coils (windup) and strikes (lunge). */
export function longNeck(ctx: Ctx, pose: number, fill: string): void {
  ctx.fillStyle = fill;
  // Robe.
  ctx.beginPath();
  ctx.moveTo(-5, -6);
  ctx.quadraticCurveTo(0, -9, 5, -6);
  ctx.lineTo(9, 16);
  ctx.lineTo(-9, 16);
  ctx.closePath();
  ctx.fill();
  // Neck path and head position per pose: walk, windup (coiled back), lunge (thrown forward).
  const head = pose === 2 ? { x: 30, y: -14 } : pose === 1 ? { x: -10, y: -26 } : { x: 3, y: -22 };
  ctx.strokeStyle = fill;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  if (pose === 1) ctx.bezierCurveTo(10, -14, -16, -18, head.x, head.y);
  else ctx.quadraticCurveTo(head.x * 0.4, head.y * 0.9, head.x, head.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(head.x, head.y, 5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hair: a crown and a long tress trailing from the back of the head.
  ctx.fillStyle = PALETTE.ink;
  ctx.strokeStyle = fill;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.ellipse(head.x - 1, head.y - 1, 4.2, 5, 0, Math.PI * 0.9, Math.PI * 2.1);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(head.x - 4, head.y - 2);
  ctx.quadraticCurveTo(head.x - 12, head.y + 2, head.x - 14, head.y + 10);
  ctx.quadraticCurveTo(head.x - 8, head.y + 3, head.x - 2, head.y + 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Narrow eyes; the mouth splits open on the strike.
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(head.x + 1, head.y + 0.5);
  ctx.lineTo(head.x + 3.6, head.y - 0.4);
  ctx.stroke();
  if (pose === 2) {
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.ellipse(head.x + 2.5, head.y + 3.5, 1.6, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Lantern Mouth: a paper lantern with a jagged mouth (open while spitting). */
export function lanternMouth(ctx: Ctx, frame: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-6, -17, 12, 3);
  ctx.fillRect(-6, 14, 12, 3);
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (const y of [-8, 8]) {
    ctx.moveTo(-10, y);
    ctx.lineTo(10, y);
  }
  ctx.stroke();
  // Mouth.
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  const open = frame === 1 ? 5 : 1.5;
  ctx.moveTo(-7, 2);
  for (let i = 0; i <= 6; i++) ctx.lineTo(-7 + (i * 14) / 6, 2 + (i % 2 === 0 ? 0 : 2));
  ctx.lineTo(7, 2 + open);
  for (let i = 6; i >= 0; i--) ctx.lineTo(-7 + (i * 14) / 6, 2 + open - (i % 2 === 0 ? 0 : 2));
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-4, -4, 1.6, 0, Math.PI * 2);
  ctx.arc(4, -4, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

/** Bone Colossus: a towering skeleton; frame 1 raises its arms to slam. */
export function colossus(ctx: Ctx, frame: number, fill: string): void {
  ctx.fillStyle = fill;
  // Skull.
  ctx.beginPath();
  ctx.ellipse(0, -34, 13, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.ellipse(-5, -35, 3.5, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -35, 3.5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fill;
  // Ribcage.
  ctx.fillRect(-2, -24, 4, 34);
  for (let i = 0; i < 5; i++) {
    const y = -20 + i * 6;
    ctx.beginPath();
    ctx.ellipse(0, y, 16 - i, 2, 0, Math.PI, 0);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = fill;
    ctx.stroke();
  }
  // Pelvis and legs.
  ctx.fillRect(-12, 10, 24, 5);
  ctx.fillRect(-11, 15, 4, 24);
  ctx.fillRect(7, 15, 4, 24);
  // Arms: down (walk) or up (slam windup).
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (frame === 1) {
    ctx.moveTo(-16, -22);
    ctx.lineTo(-26, -50);
    ctx.moveTo(16, -22);
    ctx.lineTo(26, -50);
  } else {
    ctx.moveTo(-16, -22);
    ctx.lineTo(-24, 6);
    ctx.moveTo(16, -22);
    ctx.lineTo(24, 6);
  }
  ctx.stroke();
}

/** Mother of Lanterns: a towering veiled woman crowned with dark lanterns. */
export function mother(ctx: Ctx, frame: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, -40);
  ctx.quadraticCurveTo(20, -36, 22, -10);
  ctx.quadraticCurveTo(30, 20, 34, 40);
  ctx.lineTo(-34, 40);
  ctx.quadraticCurveTo(-30, 20, -22, -10);
  ctx.quadraticCurveTo(-20, -36, 0, -40);
  ctx.closePath();
  ctx.fill();
  // Face: a hollow oval.
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.ellipse(0, -22, 7, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Unlit lanterns (ink) hanging around her.
  const lift = frame === 1 ? -4 : 0;
  for (const [x, y] of [
    [-30, -30],
    [30, -30],
    [-38, -4],
    [38, -4],
  ] as const) {
    ctx.fillStyle = fill;
    ctx.fillRect(x - 0.6, y - 12 + lift, 1.2, 8);
    ctx.beginPath();
    ctx.ellipse(x, y + lift, 5, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(x - 4, y - 1 + lift, 8, 1);
  }
}

/** The Lantern-Eater: a shadow-maw. Bone outline around ink. */
export function lanternEater(ctx: Ctx, frame: number, fill: string): void {
  const gape = frame === 0 ? 6 : 12;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(0, 0, 24, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-14, 2);
  for (let i = 0; i <= 8; i++) ctx.lineTo(-14 + (i * 28) / 8, 2 + (i % 2 === 0 ? 0 : gape));
  ctx.lineTo(14, 2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-7, -7, 2.4, 0, Math.PI * 2);
  ctx.arc(7, -7, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

/** Lantern Burst pickup: a paper chōchin lantern with light leaking out. */
export function burstLantern(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 0.8;
  for (const y of [-5, -1.7, 1.7, 5]) {
    const w = Math.sqrt(Math.max(0, 1 - (y / 9) ** 2)) * 7;
    ctx.beginPath();
    ctx.moveTo(-w, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.fillStyle = PALETTE.bone;
  ctx.fillRect(-4, -11, 8, 2.5);
  ctx.fillRect(-4, 8.5, 8, 2.5);
  // Rays.
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 11, Math.sin(a) * 12);
    ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 15);
    ctx.stroke();
  }
}

/** Spirit Call pickup: a magatama jewel trailing a thread. */
export function magatama(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(-1, -2, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(5, -2);
  ctx.quadraticCurveTo(5, 8, -4, 9);
  ctx.quadraticCurveTo(2, 4, -1, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.arc(-1.5, -3, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.bone;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-1.5, -3);
  ctx.bezierCurveTo(-8, -10, -2, -12, -9, -13);
  ctx.stroke();
}

/** Frenzy pickup: a round festival uchiwa fan with a tomoe swirl. */
export function festivalFan(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.bone;
  ctx.fillRect(-1, 5, 2, 8);
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(0, -2, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.ink;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const cx = Math.cos(a) * 2.6;
    const cy = -2 + Math.sin(a) * 2.6;
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a + 1.6) * 2, cy + Math.sin(a + 1.6) * 2);
    ctx.quadraticCurveTo(
      Math.cos(a + 1) * 6,
      -2 + Math.sin(a + 1) * 6,
      Math.cos(a + 2.2) * 5.5,
      -2 + Math.sin(a + 2.2) * 5.5,
    );
    ctx.lineTo(cx + Math.cos(a - 1.6) * 2, cy + Math.sin(a - 1.6) * 2);
    ctx.fill();
  }
}

/** The Sealed Well: a square stone curb bound with a straw rope and paper streamers. */
export function sealedWell(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.bone;
  ctx.fillRect(-16, -6, 32, 18);
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(-12, -6, 24, 6);
  // Stone joints.
  ctx.fillRect(-6, 2, 1.2, 10);
  ctx.fillRect(6, 2, 1.2, 10);
  ctx.fillRect(-16, 6, 32, 1.2);
  // Shimenawa rope across the mouth.
  ctx.strokeStyle = PALETTE.ash;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-18, -7);
  ctx.quadraticCurveTo(0, -1, 18, -7);
  ctx.stroke();
  // Zigzag shide streamers.
  ctx.fillStyle = PALETTE.bone;
  for (const x of [-9, 0, 9]) {
    ctx.beginPath();
    ctx.moveTo(x - 2, -4);
    ctx.lineTo(x + 2, -4);
    ctx.lineTo(x, 1);
    ctx.lineTo(x + 3, 1);
    ctx.lineTo(x - 1, 7);
    ctx.lineTo(x - 2, 2);
    ctx.lineTo(x - 4, 2);
    ctx.closePath();
    ctx.fill();
  }
}
