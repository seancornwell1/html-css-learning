import { PALETTE } from './palette';

/**
 * In-play character figures (GAME_DESIGN §7.3.1), facing +x, in world units
 * (about 30 × 46, anchored at the body centre). Bone silhouettes with ink
 * hair masses and a few ink details, so each character reads at play size;
 * the woodblock finish (keyline + motif) is added at bake time.
 */
type Ctx = CanvasRenderingContext2D;

export function drawFigure(ctx: Ctx, id: string, frame: number): void {
  const bob = frame % 2 === 0 ? 0 : -1;
  const step = [0, 1.6, 0, -1.6][frame] ?? 0;
  const art = FIGURES[id] ?? FIGURES.akari;
  art?.back?.(ctx, bob, step);
  body(ctx, bob, step, art?.wide ?? 0, art?.short ?? 0);
  head(ctx, bob, art?.short ?? 0, art?.blank === true);
  art?.hair(ctx, bob + (art.short ?? 0));
  art?.front?.(ctx, bob, step);
}

/**
 * Fill the current path; ink masses (hair, hoods) get a thin bone rim so
 * they read against the night, like a print's key block on dark paper.
 */
function mass(ctx: Ctx): void {
  ctx.fill();
  if (String(ctx.fillStyle).toLowerCase() !== PALETTE.ink.toLowerCase()) return;
  ctx.save();
  ctx.strokeStyle = PALETTE.bone;
  ctx.lineWidth = 0.9;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

interface Figure {
  hair: (ctx: Ctx, bob: number) => void;
  back?: (ctx: Ctx, bob: number, step: number) => void;
  front?: (ctx: Ctx, bob: number, step: number) => void;
  /** Extra shoulder width (Tetsu). */
  wide?: number;
  /** Drop the head this much (Hotaru, a child). */
  short?: number;
  /** Kagerou: no face. */
  blank?: boolean;
}

/** Kimono body: sloped shoulders, sleeve, obi, a hem that swings with the step. */
function body(ctx: Ctx, bob: number, step: number, wide: number, short: number): void {
  const top = -8 + bob + short;
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath();
  ctx.moveTo(-5 - wide, top + 1);
  ctx.quadraticCurveTo(1, top - 2, 7 + wide, top + 1);
  ctx.lineTo(9 + wide * 0.5 + step * 0.4, 14);
  // Hem: two flaps that open with the stride.
  ctx.lineTo(3 + step, 15);
  ctx.lineTo(1, 12.5);
  ctx.lineTo(-2 - step, 15);
  ctx.lineTo(-9 - wide * 0.5, 14);
  ctx.closePath();
  ctx.fill();
  // Hanging sleeve on the far side, swinging opposite the step.
  ctx.beginPath();
  ctx.moveTo(-5 - wide, top + 2);
  ctx.quadraticCurveTo(-12 - wide - step * 0.5, top + 8, -9 - wide - step * 0.5, top + 13);
  ctx.lineTo(-4 - wide, top + 10);
  ctx.closePath();
  ctx.fill();
  // Ink details: crossed collar and the obi.
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-1, top + 0.5);
  ctx.lineTo(3.5, top + 7);
  ctx.lineTo(6, top + 0.5);
  ctx.stroke();
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(-6 - wide * 0.6, top + 8.5, 14 + wide * 1.2, 2.4);
}

/** Head in three-quarter view: the face shows on the +x side. */
function head(ctx: Ctx, bob: number, short: number, blank: boolean): void {
  const y = -14 + bob + short;
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath();
  ctx.ellipse(2, y, 5, 5.8, 0.1, 0, Math.PI * 2);
  ctx.fill();
  if (blank) return;
  // One big anime eye (ink with a bone catchlight) on the facing side.
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.ellipse(4.6, y + 0.4, 1.3, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.bone;
  ctx.fillRect(4.1, y - 0.6, 0.6, 0.6);
}

const FIGURES: Record<string, Figure> = {
  akari: {
    // Hime cut and a long fall of hair down the back.
    back: (ctx, bob) => {
      ctx.fillStyle = PALETTE.ink;
      ctx.beginPath();
      ctx.moveTo(-3, -18 + bob);
      ctx.quadraticCurveTo(-8, -4 + bob, -6, 8);
      ctx.lineTo(-1, 6);
      ctx.lineTo(1, -12 + bob);
      ctx.closePath();
      mass(ctx);
    },
    hair: (ctx, bob) => {
      ctx.fillStyle = PALETTE.ink;
      ctx.beginPath();
      ctx.moveTo(-3.5, -12 + bob);
      ctx.quadraticCurveTo(-3, -21 + bob, 3, -20.5 + bob);
      ctx.quadraticCurveTo(7.8, -19.5 + bob, 7.2, -15.2 + bob);
      // Blunt bangs.
      ctx.lineTo(2.4, -15.2 + bob);
      ctx.lineTo(2.2, -12 + bob);
      ctx.closePath();
      mass(ctx);
    },
  },
  ren: {
    hair: (ctx, bob) => {
      ctx.fillStyle = PALETTE.ink;
      ctx.beginPath();
      ctx.moveTo(-3.5, -12 + bob);
      ctx.quadraticCurveTo(-3, -20.5 + bob, 3, -20 + bob);
      ctx.quadraticCurveTo(7.5, -19 + bob, 6.8, -16 + bob);
      ctx.lineTo(1, -16.5 + bob);
      ctx.closePath();
      mass(ctx);
      // Topknot.
      ctx.beginPath();
      ctx.ellipse(-0.5, -21.5 + bob, 2.4, 1.8, 0, 0, Math.PI * 2);
      mass(ctx);
      // Paper headband tail.
      ctx.fillStyle = PALETTE.bone;
      ctx.fillRect(-7, -17.5 + bob, 4, 1.2);
    },
    front: (ctx, bob) => {
      // A talisman held out front.
      ctx.fillStyle = PALETTE.bone;
      ctx.fillRect(9, -6 + bob, 2.6, 7);
      ctx.fillStyle = PALETTE.ink;
      ctx.fillRect(9.9, -4.6 + bob, 0.8, 4);
    },
  },
  tetsu: {
    wide: 2.5,
    hair: (ctx, bob) => {
      ctx.fillStyle = PALETTE.ink;
      ctx.beginPath();
      ctx.moveTo(-3.5, -13 + bob);
      ctx.lineTo(-3, -19 + bob);
      ctx.lineTo(0, -21 + bob);
      ctx.lineTo(4, -20.5 + bob);
      ctx.lineTo(7, -17.5 + bob);
      ctx.lineTo(1, -17 + bob);
      ctx.closePath();
      mass(ctx);
      // Hachimaki with knot tails.
      ctx.fillStyle = PALETTE.bone;
      ctx.fillRect(-3.5, -18.2 + bob, 10, 1.6);
      ctx.beginPath();
      ctx.moveTo(-3.5, -18 + bob);
      ctx.lineTo(-8, -20 + bob);
      ctx.lineTo(-7.5, -18 + bob);
      ctx.lineTo(-8.5, -15.5 + bob);
      ctx.closePath();
      mass(ctx);
    },
    front: (ctx, bob) => {
      // Chain over the shoulder.
      ctx.strokeStyle = PALETTE.ash;
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(-4 + i * 3, -6 + bob + i * 2.2, 1.3, 0.9, 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
  },
  hotaru: {
    short: 3,
    back: (ctx, bob) => {
      // Moth wings on the back, gold-dusted.
      ctx.fillStyle = PALETTE.bone;
      ctx.beginPath();
      ctx.ellipse(-7, -6 + bob, 6, 3.4, -0.7, 0, Math.PI * 2);
      mass(ctx);
      ctx.beginPath();
      ctx.ellipse(-6, 0 + bob, 4, 2.4, 0.4, 0, Math.PI * 2);
      mass(ctx);
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(-8, -7 + bob, 1.1, 0, Math.PI * 2);
      mass(ctx);
    },
    hair: (ctx, bob) => {
      // Bob cut.
      ctx.fillStyle = PALETTE.ink;
      ctx.beginPath();
      ctx.moveTo(-4, -9 + bob);
      ctx.quadraticCurveTo(-5, -21 + bob, 3, -20.5 + bob);
      ctx.quadraticCurveTo(8.5, -19.5 + bob, 7.4, -15 + bob);
      ctx.lineTo(3, -16 + bob);
      ctx.lineTo(1, -10 + bob);
      ctx.closePath();
      mass(ctx);
    },
  },
  kagerou: {
    blank: true,
    hair: (ctx, bob) => {
      // Deep hood: the face is a blank oval inside it.
      ctx.fillStyle = PALETTE.ash;
      ctx.beginPath();
      ctx.moveTo(-5, -7 + bob);
      ctx.quadraticCurveTo(-6, -22 + bob, 3, -21.5 + bob);
      ctx.quadraticCurveTo(9.5, -20 + bob, 8.6, -13 + bob);
      ctx.lineTo(6.6, -13 + bob);
      ctx.quadraticCurveTo(6, -18 + bob, 2, -18 + bob);
      ctx.quadraticCurveTo(-2, -16 + bob, 0, -7 + bob);
      ctx.closePath();
      mass(ctx);
    },
  },
  ido: {
    back: (ctx, bob) => {
      // Long wet hair clinging down the back in strands.
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      for (const [x, len] of [
        [-3, 18],
        [-1, 22],
        [1, 16],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(x, -16 + bob);
        ctx.quadraticCurveTo(x - 3, -6 + bob, x - 1, -16 + len + bob);
        ctx.strokeStyle = PALETTE.bone;
        ctx.lineWidth = 2.8;
        ctx.stroke();
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    },
    hair: (ctx, bob) => {
      ctx.fillStyle = PALETTE.ink;
      ctx.beginPath();
      ctx.moveTo(-3.5, -12 + bob);
      ctx.quadraticCurveTo(-3, -21 + bob, 3, -20.5 + bob);
      ctx.quadraticCurveTo(8, -19.5 + bob, 7, -13 + bob);
      ctx.lineTo(5, -16 + bob);
      ctx.lineTo(3.5, -11 + bob);
      ctx.lineTo(2, -15.5 + bob);
      ctx.closePath();
      mass(ctx);
    },
  },
};
