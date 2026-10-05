import { motifTile, type Motif } from './ink';
import { PALETTE, PRINT, withAlpha } from './palette';

/**
 * Character portraits (GAME_DESIGN §7.3.1): bust illustrations drawn in code
 * in a modern-anime × ukiyo-e style. Anime faces (large dark eyes with a
 * sharp catchlight, solid hair masses with strand cuts) over woodblock
 * staging (indigo bokashi sky, a pale moon, flat patterned kimono, brush
 * outlines, a vermilion seal). Original designs only.
 *
 * Drawn in a 240×300 design space and scaled to the target canvas.
 */
const W = 240;
const H = 300;

type Ctx = CanvasRenderingContext2D;

interface Look {
  motif: Motif;
  /** Kimono ground and pattern ink. */
  robe: string;
  robeInk: string;
  hair: (ctx: Ctx) => void;
  /** Hair drawn behind the head (long hair, wings, hoods). */
  back?: (ctx: Ctx) => void;
  face: 'calm' | 'stern' | 'bright' | 'none' | 'sad';
  /** Props drawn in front of the robe. */
  front?: (ctx: Ctx) => void;
  /** Seal mark drawn inside the vermilion square. */
  seal: (ctx: Ctx) => void;
  /** Head scale (1 = adult). */
  head?: number;
}

export function drawPortrait(ctx: Ctx, id: string, width: number, height: number): void {
  const look = LOOKS[id] ?? LOOKS.akari;
  if (!look) return;
  ctx.save();
  const s = Math.min(width / W, height / H);
  ctx.translate((width - W * s) / 2, (height - H * s) / 2);
  ctx.scale(s, s);
  sky(ctx);
  look.back?.(ctx);
  const k = (look.head ?? 1) * 1.18;
  const scaled = (draw: () => void): void => {
    ctx.save();
    ctx.translate(120, 128);
    ctx.scale(k, k);
    ctx.translate(-120, -128);
    draw();
    ctx.restore();
  };
  // Neck under the robe so the collar overlaps it; head and hair on top.
  scaled(() => neck(ctx));
  robe(ctx, look);
  scaled(() => {
    head(ctx, look.face);
    look.hair(ctx);
  });
  look.front?.(ctx);
  seal(ctx, look.seal);
  ctx.restore();
}

/** A canvas with the portrait baked at device resolution. */
export function portraitCanvas(id: string, cssW: number, cssH: number): HTMLCanvasElement {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = Math.round(cssW * dpr);
  c.height = Math.round(cssH * dpr);
  c.style.width = `${cssW}px`;
  c.style.height = `${cssH}px`;
  c.className = 'portrait';
  const ctx = c.getContext('2d');
  if (ctx) drawPortrait(ctx, id, c.width, c.height);
  return c;
}

// ---- staging ---------------------------------------------------------------

function sky(ctx: Ctx): void {
  // Bokashi: indigo band at the top, graded into ink.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, PRINT.ai);
  g.addColorStop(0.45, PRINT.aiDeep);
  g.addColorStop(1, PALETTE.ink);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Pale moon behind the head.
  ctx.fillStyle = withAlpha(PALETTE.bone, 0.1);
  ctx.beginPath();
  ctx.arc(150, 92, 74, 0, Math.PI * 2);
  ctx.fill();
  // Stylised clouds: stacked rounded bands, flat, like a print.
  ctx.fillStyle = withAlpha(PALETTE.bone, 0.07);
  for (const [x, y, w] of [
    [10, 46, 90],
    [150, 168, 80],
    [-20, 196, 70],
  ] as const) {
    cloud(ctx, x, y, w);
  }
}

function cloud(ctx: Ctx, x: number, y: number, w: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + 8);
  ctx.arc(x + w * 0.2, y + 2, 8, Math.PI, 0);
  ctx.arc(x + w * 0.45, y - 2, 11, Math.PI, 0);
  ctx.arc(x + w * 0.72, y + 3, 8, Math.PI, 0);
  ctx.lineTo(x + w, y + 8);
  ctx.closePath();
  ctx.fill();
}

function robe(ctx: Ctx, look: Look): void {
  // Shoulders and kimono, flat fill with a printed motif.
  ctx.beginPath();
  ctx.moveTo(18, H);
  ctx.bezierCurveTo(22, 236, 52, 206, 96, 196);
  ctx.lineTo(144, 196);
  ctx.bezierCurveTo(188, 206, 218, 236, 222, H);
  ctx.closePath();
  ctx.fillStyle = look.robe;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const tile = motifTile(look.motif, 2.2);
  const pat = ctx.createPattern(tile, 'repeat');
  if (pat) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 180, W, H - 180);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  brush(ctx, look.robeInk, 3.2);
  // Crossed collar (left over right): bone under-collar, ink over-collar.
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath();
  ctx.moveTo(100, 196);
  ctx.lineTo(120, 252);
  ctx.lineTo(140, 196);
  ctx.lineTo(132, 196);
  ctx.lineTo(120, 230);
  ctx.lineTo(108, 196);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.moveTo(92, 198);
  ctx.lineTo(126, 270);
  ctx.lineTo(118, 274);
  ctx.lineTo(84, 202);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(148, 198);
  ctx.lineTo(120, 256);
  ctx.lineTo(128, 262);
  ctx.lineTo(156, 202);
  ctx.closePath();
  ctx.fill();
}

function neck(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath();
  ctx.moveTo(108, 160);
  ctx.lineTo(106, 206);
  ctx.lineTo(134, 206);
  ctx.lineTo(132, 160);
  ctx.closePath();
  ctx.fill();
  // Shadow under the jaw: a flat ash wedge (no soft shading).
  ctx.fillStyle = PALETTE.ash;
  ctx.beginPath();
  ctx.moveTo(108, 168);
  ctx.quadraticCurveTo(120, 182, 132, 168);
  ctx.lineTo(132, 176);
  ctx.quadraticCurveTo(120, 190, 108, 176);
  ctx.closePath();
  ctx.fill();
}

/** Anime face: soft cheek to a pointed chin, big eyes, minimal nose/mouth. */
function head(ctx: Ctx, face: Look['face']): void {
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath();
  ctx.moveTo(88, 104);
  ctx.bezierCurveTo(86, 140, 100, 168, 120, 178);
  ctx.bezierCurveTo(140, 168, 154, 140, 152, 104);
  ctx.bezierCurveTo(150, 70, 90, 70, 88, 104);
  ctx.closePath();
  ctx.fill();
  brush(ctx, PALETTE.ink, 2.2);
  if (face === 'none') {
    // Kagerou: a blank face with one hairline crack.
    ctx.strokeStyle = PALETTE.ash;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(126, 96);
    ctx.lineTo(118, 118);
    ctx.lineTo(124, 132);
    ctx.lineTo(116, 156);
    ctx.stroke();
    return;
  }
  const lid = face === 'stern' ? 0.6 : face === 'sad' ? 0.45 : face === 'bright' ? 1.1 : 0.85;
  eye(ctx, 104, 122, 1, lid, face);
  eye(ctx, 136, 122, -1, lid, face);
  // Brows.
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineCap = 'round';
  ctx.lineWidth = 2;
  const tilt = face === 'stern' ? 4 : face === 'sad' ? -4 : 0;
  ctx.beginPath();
  ctx.moveTo(95, 108 - tilt * 0.2);
  ctx.quadraticCurveTo(103, 104, 112, 107 + tilt);
  ctx.moveTo(145, 108 - tilt * 0.2);
  ctx.quadraticCurveTo(137, 104, 128, 107 + tilt);
  ctx.stroke();
  // Nose: one short stroke. Mouth: one small line.
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(121, 138);
  ctx.lineTo(119, 145);
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (face === 'bright') {
    ctx.moveTo(113, 156);
    ctx.quadraticCurveTo(120, 162, 127, 156);
  } else {
    ctx.moveTo(114, 157);
    ctx.lineTo(126, 157 + (face === 'sad' ? 1 : 0));
  }
  ctx.stroke();
}

function eye(
  ctx: Ctx,
  cx: number,
  cy: number,
  side: number,
  lid: number,
  face: Look['face'],
): void {
  const w = 13;
  const h = 9 * lid;
  // Upper lash line: thick, swept out to the side (anime).
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.moveTo(cx - w * side, cy + 1);
  ctx.quadraticCurveTo(cx, cy - h - 3, cx + (w + 3) * side, cy - 3);
  ctx.lineTo(cx + (w + 1) * side, cy);
  ctx.quadraticCurveTo(cx, cy - h, cx - w * side, cy + 2);
  ctx.closePath();
  ctx.fill();
  // Iris: tall dark oval, clipped by the lids.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - w * side, cy + 1);
  ctx.quadraticCurveTo(cx, cy - h - 2, cx + w * side, cy - 2);
  ctx.quadraticCurveTo(cx, cy + h * 0.9, cx - w * side, cy + 1);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.ellipse(cx + side, cy - 1, 6.5, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PRINT.ai;
  ctx.beginPath();
  ctx.ellipse(cx + side, cy + 3, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Sharp catchlight.
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath();
  ctx.ellipse(cx - 2 * side, cy - 4, 2.2, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();
  if (face === 'bright') {
    ctx.beginPath();
    ctx.arc(cx + 3 * side, cy + 3, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Lower lid: a short thin stroke.
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 4 * side, cy + h * 0.75);
  ctx.lineTo(cx + 6 * side, cy + h * 0.55);
  ctx.stroke();
}

/** Brush outline of the current path: a thick ink pass, slightly offset to the shadow side. */
function brush(ctx: Ctx, color: string, width: number): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.translate(0.9, 1.1);
  ctx.lineWidth = width * 0.7;
  ctx.stroke();
  ctx.restore();
}

function seal(ctx: Ctx, mark: (ctx: Ctx) => void): void {
  ctx.save();
  ctx.translate(198, 252);
  ctx.rotate(-0.05);
  ctx.fillStyle = PRINT.shu;
  roundRect(ctx, -16, -16, 32, 32, 3);
  ctx.fill();
  ctx.strokeStyle = PRINT.washi;
  ctx.fillStyle = PRINT.washi;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'square';
  mark(ctx);
  ctx.restore();
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- hair & props ------------------------------------------------------------

/** Hime cut: straight blunt bangs, long side locks. */
function himeHair(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.moveTo(80, 120);
  ctx.bezierCurveTo(74, 60, 166, 60, 160, 120);
  ctx.lineTo(160, 104);
  // Blunt bangs with small notches.
  for (let x = 150; x >= 90; x -= 10) ctx.lineTo(x, x % 20 === 0 ? 108 : 106);
  ctx.lineTo(82, 106);
  ctx.closePath();
  ctx.fill();
  // Side locks to the collarbone.
  for (const side of [-1, 1]) {
    const x = 120 + side * 36;
    ctx.beginPath();
    ctx.moveTo(x, 100);
    ctx.lineTo(x + side * 6, 104);
    ctx.lineTo(x + side * 7, 190);
    ctx.lineTo(x - side * 2, 196);
    ctx.lineTo(x - side * 3, 120);
    ctx.closePath();
    ctx.fill();
  }
  sheen(ctx, 96, 80);
}

function longBack(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.moveTo(76, 100);
  ctx.bezierCurveTo(60, 160, 62, 230, 54, 280);
  ctx.lineTo(186, 280);
  ctx.bezierCurveTo(178, 230, 180, 160, 164, 100);
  ctx.closePath();
  ctx.fill();
}

/** Tied-up hair with a few loose strands and a talisman band. */
function exorcistHair(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.moveTo(82, 118);
  ctx.bezierCurveTo(70, 56, 170, 56, 158, 118);
  ctx.lineTo(150, 98);
  ctx.lineTo(138, 106);
  ctx.lineTo(128, 94);
  ctx.lineTo(116, 108);
  ctx.lineTo(104, 94);
  ctx.lineTo(92, 108);
  ctx.closePath();
  ctx.fill();
  // Topknot.
  ctx.beginPath();
  ctx.ellipse(120, 62, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Loose strands.
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(90, 106);
  ctx.quadraticCurveTo(84, 140, 92, 160);
  ctx.moveTo(150, 106);
  ctx.quadraticCurveTo(158, 136, 150, 152);
  ctx.stroke();
  // Paper headband with an ink mark.
  ctx.fillStyle = PALETTE.bone;
  ctx.fillRect(86, 86, 68, 7);
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(117, 87, 6, 5);
  sheen(ctx, 100, 74);
}

/** Cropped rough hair under a knotted hachimaki. */
function digHair(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.moveTo(84, 112);
  ctx.bezierCurveTo(78, 66, 162, 66, 156, 112);
  ctx.lineTo(148, 100);
  ctx.lineTo(140, 108);
  ctx.lineTo(130, 98);
  ctx.lineTo(120, 106);
  ctx.lineTo(108, 98);
  ctx.lineTo(98, 108);
  ctx.lineTo(90, 100);
  ctx.closePath();
  ctx.fill();
  // Hachimaki with trailing knot ends.
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath();
  ctx.moveTo(84, 92);
  ctx.lineTo(156, 88);
  ctx.lineTo(157, 97);
  ctx.lineTo(84, 101);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(156, 90);
  ctx.lineTo(176, 82);
  ctx.lineTo(178, 90);
  ctx.lineTo(158, 96);
  ctx.moveTo(156, 94);
  ctx.lineTo(172, 104);
  ctx.lineTo(168, 110);
  ctx.closePath();
  ctx.fill();
  // Scar across the cheek.
  ctx.strokeStyle = PALETTE.ash;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(136, 134);
  ctx.lineTo(146, 146);
  ctx.moveTo(140, 132);
  ctx.lineTo(139, 142);
  ctx.stroke();
}

/** Child's bob with a moth clip. */
function bobHair(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.moveTo(80, 150);
  ctx.bezierCurveTo(66, 60, 174, 60, 160, 150);
  ctx.lineTo(150, 146);
  ctx.lineTo(148, 112);
  ctx.lineTo(136, 102);
  ctx.lineTo(126, 110);
  ctx.lineTo(116, 100);
  ctx.lineTo(104, 108);
  ctx.lineTo(94, 104);
  ctx.lineTo(92, 146);
  ctx.closePath();
  ctx.fill();
  moth(ctx, 150, 92, 0.9);
  sheen(ctx, 98, 78);
}

/** Deep hood that hides the hair entirely. */
function hood(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.ink2;
  ctx.beginPath();
  ctx.moveTo(74, 200);
  ctx.bezierCurveTo(60, 120, 76, 52, 120, 50);
  ctx.bezierCurveTo(164, 52, 180, 120, 166, 200);
  ctx.lineTo(150, 200);
  ctx.bezierCurveTo(160, 140, 152, 92, 120, 88);
  ctx.bezierCurveTo(88, 92, 80, 140, 90, 200);
  ctx.closePath();
  ctx.fill();
  brush(ctx, PALETTE.ash, 1.6);
}

/** Wet hair: long, clinging strands that drip. */
function wetHair(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.moveTo(82, 124);
  ctx.bezierCurveTo(72, 62, 168, 62, 158, 124);
  ctx.lineTo(152, 104);
  ctx.quadraticCurveTo(140, 116, 136, 136);
  ctx.quadraticCurveTo(132, 112, 120, 104);
  ctx.quadraticCurveTo(110, 118, 104, 140);
  ctx.quadraticCurveTo(100, 114, 88, 106);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const [x, len] of [
    [86, 120],
    [92, 96],
    [150, 110],
    [156, 84],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x, 110);
    ctx.bezierCurveTo(x - 4, 150, x + 4, 170, x, 110 + len);
    ctx.stroke();
  }
  // Drips.
  ctx.fillStyle = withAlpha(PALETTE.bone, 0.7);
  for (const [x, y] of [
    [92, 214],
    [150, 200],
    [86, 236],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(x, y, 1.6, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function sheen(ctx: Ctx, x: number, y: number): void {
  // A single flat highlight band across the crown (anime hair shine).
  ctx.strokeStyle = withAlpha(PALETTE.bone, 0.28);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + 6);
  ctx.quadraticCurveTo(x + 24, y - 6, x + 48, y + 4);
  ctx.stroke();
}

function moth(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = PALETTE.gold;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 6, -2, 7, 5, side * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(side * 4, 4, 4, 3, side * -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(-1, -5, 2, 11);
  ctx.restore();
}

function lanternProp(ctx: Ctx): void {
  // Akari's lantern on its pole, glowing gold at lower right.
  ctx.strokeStyle = PALETTE.bone;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(206, 300);
  ctx.lineTo(186, 196);
  ctx.stroke();
  const glow = ctx.createRadialGradient(178, 214, 4, 178, 214, 60);
  glow.addColorStop(0, withAlpha(PALETTE.gold, 0.5));
  glow.addColorStop(1, withAlpha(PALETTE.gold, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(110, 150, 130, 130);
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.ellipse(178, 214, 14, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 1.2;
  for (const dy of [-10, -4, 2, 8]) {
    const w = Math.sqrt(Math.max(0, 1 - (dy / 18) ** 2)) * 14;
    ctx.beginPath();
    ctx.moveTo(178 - w, 214 + dy);
    ctx.lineTo(178 + w, 214 + dy);
    ctx.stroke();
  }
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(170, 194, 16, 4);
  ctx.fillRect(170, 230, 16, 4);
}

function ofudaProp(ctx: Ctx): void {
  // Talismans drifting around the shoulders.
  for (const [x, y, a] of [
    [40, 150, -0.4],
    [196, 132, 0.3],
    [212, 196, 0.6],
  ] as const) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = PALETTE.bone;
    ctx.fillRect(-6, -18, 12, 36);
    ctx.fillStyle = PRINT.shu;
    ctx.fillRect(-4, -15, 8, 3);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(-1, -9, 2, 20);
    ctx.fillRect(-4, -2, 8, 2);
    ctx.restore();
  }
}

function chainProp(ctx: Ctx): void {
  // A chain over the shoulder ending in a sickle blade.
  ctx.strokeStyle = PALETTE.ash;
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x = 60 + t * 110;
    const y = 214 + Math.sin(t * Math.PI) * 30;
    ctx.beginPath();
    ctx.ellipse(x, y, 5, 3, t * 1.2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath();
  ctx.moveTo(176, 222);
  ctx.quadraticCurveTo(214, 214, 222, 246);
  ctx.quadraticCurveTo(204, 226, 178, 232);
  ctx.closePath();
  ctx.fill();
}

function mothsBack(ctx: Ctx): void {
  for (const [x, y, s] of [
    [40, 70, 1.4],
    [206, 56, 1.1],
    [30, 180, 1],
    [214, 150, 1.6],
    [62, 120, 0.8],
  ] as const) {
    moth(ctx, x, y, s);
  }
}

function mirrorProp(ctx: Ctx): void {
  // Floating mirror shards catching the moon.
  for (const [x, y, a] of [
    [42, 140, 0.3],
    [200, 120, -0.5],
    [190, 196, 0.9],
  ] as const) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = PALETTE.bone;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(7, 4);
    ctx.lineTo(-2, 12);
    ctx.lineTo(-6, -2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PALETTE.ash;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-3, -6);
    ctx.lineTo(4, 2);
    ctx.stroke();
    ctx.restore();
  }
}

function koiBack(ctx: Ctx): void {
  // Ripples and two koi circling behind (seigaiha water).
  ctx.strokeStyle = withAlpha(PALETTE.bone, 0.18);
  ctx.lineWidth = 1.5;
  for (let r = 30; r <= 110; r += 20) {
    ctx.beginPath();
    ctx.ellipse(120, 250, r * 1.4, r * 0.4, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  for (const [x, y, a] of [
    [44, 96, 0.8],
    [198, 70, -2.4],
  ] as const) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = PALETTE.bone;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.quadraticCurveTo(0, -9, 14, 0);
    ctx.quadraticCurveTo(0, 9, -16, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(-24, -7);
    ctx.lineTo(-22, 0);
    ctx.lineTo(-24, 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PRINT.shu;
    ctx.beginPath();
    ctx.ellipse(2, -2, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ---- seals: simple original marks, not real script --------------------------

const SEAL_MARKS: Record<string, (ctx: Ctx) => void> = {
  lantern: (c) => {
    c.strokeRect(-6, -9, 12, 16);
    c.beginPath();
    c.moveTo(-9, -11);
    c.lineTo(9, -11);
    c.moveTo(-9, 10);
    c.lineTo(9, 10);
    c.stroke();
  },
  strip: (c) => {
    c.strokeRect(-4, -11, 8, 22);
    c.beginPath();
    c.moveTo(-8, 0);
    c.lineTo(8, 0);
    c.stroke();
  },
  spade: (c) => {
    c.beginPath();
    c.moveTo(0, -11);
    c.lineTo(0, 4);
    c.moveTo(-7, 4);
    c.lineTo(7, 4);
    c.lineTo(0, 11);
    c.closePath();
    c.stroke();
  },
  wing: (c) => {
    c.beginPath();
    c.ellipse(-5, -2, 5, 7, 0.4, 0, Math.PI * 2);
    c.moveTo(10, -2);
    c.ellipse(5, -2, 5, 7, -0.4, 0, Math.PI * 2);
    c.stroke();
  },
  blank: (c) => {
    c.beginPath();
    c.ellipse(0, 0, 7, 10, 0, 0, Math.PI * 2);
    c.stroke();
  },
  well: (c) => {
    c.beginPath();
    c.moveTo(-10, -5);
    c.lineTo(10, -5);
    c.moveTo(-10, 5);
    c.lineTo(10, 5);
    c.moveTo(-5, -10);
    c.lineTo(-5, 10);
    c.moveTo(5, -10);
    c.lineTo(5, 10);
    c.stroke();
  },
};

const mark = (id: string) => SEAL_MARKS[id] ?? (() => undefined);

const LOOKS: Record<string, Look> = {
  akari: {
    motif: 'sakura',
    robe: PALETTE.ink2,
    robeInk: PALETTE.ink,
    back: longBack,
    hair: himeHair,
    face: 'calm',
    front: lanternProp,
    seal: mark('lantern'),
  },
  ren: {
    motif: 'asanoha',
    robe: PALETTE.ink2,
    robeInk: PALETTE.ink,
    hair: exorcistHair,
    face: 'stern',
    front: ofudaProp,
    seal: mark('strip'),
  },
  tetsu: {
    motif: 'kikko',
    robe: PALETTE.ink2,
    robeInk: PALETTE.ink,
    hair: digHair,
    face: 'stern',
    front: chainProp,
    seal: mark('spade'),
  },
  hotaru: {
    motif: 'seigaiha',
    robe: PALETTE.ink2,
    robeInk: PALETTE.ink,
    back: mothsBack,
    hair: bobHair,
    face: 'bright',
    head: 0.92,
    seal: mark('wing'),
  },
  kagerou: {
    motif: 'asanoha',
    robe: PALETTE.ink2,
    robeInk: PALETTE.ash,
    hair: hood,
    face: 'none',
    front: mirrorProp,
    seal: mark('blank'),
  },
  ido: {
    motif: 'seigaiha',
    robe: PRINT.aiDeep,
    robeInk: PALETTE.ink,
    back: koiBack,
    hair: wetHair,
    face: 'sad',
    seal: mark('well'),
  },
};
