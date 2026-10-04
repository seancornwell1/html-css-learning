import { Rng } from '../sim/rng';
import { PALETTE } from './palette';

/**
 * Procedural silhouette sprites (GAME_DESIGN §7.3). Every shape is drawn in
 * code from paths: no image files, no traced references. Sprites are cached
 * to offscreen canvases at the current device scale, with rotations and
 * mirrored variants pre-baked, so the per-frame cost is one drawImage each.
 */
export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Offset from the top-left corner to the anchor, device px. */
  ox: number;
  oy: number;
}

export const WISP_ROTATIONS = 16;
export const OFUDA_ROTATIONS = 16;
export const WISP_FRAMES = 2;
export const WALKER_FRAMES = 4;
export const PLAYER_FRAMES = 4;
export const DECAL_VARIANTS = 6;
/** Hopping Kasa poses. */
export const KASA_POSE = { rest: 0, crouch: 1, air: 2 } as const;

type Tint = 'bone' | 'ash';
type Draw = (ctx: CanvasRenderingContext2D) => void;

function bake(scale: number, halfW: number, halfH: number, draw: Draw): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(halfW * 2 * scale));
  canvas.height = Math.max(1, Math.ceil(halfH * 2 * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas2D unavailable');
  ctx.setTransform(scale, 0, 0, scale, halfW * scale, halfH * scale);
  draw(ctx);
  return { canvas, ox: halfW * scale, oy: halfH * scale };
}

// ---- Shapes (world units, anchor at the origin) ---------------------------

/** Hitodama-like wisp: round head, wavering tail along +x. */
function wisp(ctx: CanvasRenderingContext2D, frame: number, fill: string): void {
  const wob = frame === 0 ? 3 : -3;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.bezierCurveTo(9, -8, 14, -2 + wob, 24, wob);
  ctx.bezierCurveTo(14, 3 + wob, 9, 8, 0, 7);
  ctx.arc(0, 0, 7, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fill();
}

/** Faceless walker: hunched robed figure with a blank oval head. */
function walker(ctx: CanvasRenderingContext2D, frame: number, fill: string): void {
  const sway = [0, 1.2, 0, -1.2][frame] ?? 0;
  const bob = frame % 2 === 0 ? 0 : -0.8;
  ctx.fillStyle = fill;
  ctx.beginPath();
  // Head, leaning forward (+x).
  ctx.ellipse(2.5 + sway * 0.5, -15 + bob, 5, 6.4, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  // Robe: narrow shoulders, wide ragged hem.
  ctx.moveTo(-5 + sway, -8 + bob);
  ctx.quadraticCurveTo(3 + sway, -10 + bob, 6 + sway, -7 + bob);
  ctx.lineTo(9, 13);
  const teeth = 5;
  for (let i = 0; i <= teeth; i++) {
    const x = 9 - (i / teeth) * 19;
    const y = i % 2 === 0 ? 13 : 16 + ((frame + i) % 2);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(-10, 13);
  ctx.closePath();
  ctx.fill();
  // Dangling arm.
  ctx.beginPath();
  ctx.moveTo(4 + sway, -6 + bob);
  ctx.quadraticCurveTo(9 + sway, 0, 7 + sway * 1.5, 7);
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = fill;
  ctx.lineCap = 'round';
  ctx.stroke();
}

/** Hopping Kasa: paper umbrella on one leg, one eye. Poses squash/stretch. */
function kasa(ctx: CanvasRenderingContext2D, pose: number, fill: string): void {
  const sy = pose === KASA_POSE.crouch ? 0.72 : pose === KASA_POSE.air ? 1.12 : 1;
  ctx.save();
  // Anchor at the foot so squashing reads as crouching.
  ctx.translate(0, 9);
  ctx.scale(1, sy);
  ctx.translate(0, -9);
  ctx.fillStyle = fill;
  ctx.beginPath();
  // Dome with a scalloped rim.
  ctx.moveTo(-13, -4);
  ctx.quadraticCurveTo(-11, -18, 0, -19);
  ctx.quadraticCurveTo(11, -18, 13, -4);
  for (let i = 0; i < 4; i++) {
    const x0 = 13 - i * 6.5;
    ctx.quadraticCurveTo(x0 - 3.25, -1.5, x0 - 6.5, -4);
  }
  ctx.closePath();
  ctx.fill();
  // Ribs and eye in ink: the only interior detail.
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (const x of [-6.5, 0, 6.5]) {
    ctx.moveTo(0, -19);
    ctx.lineTo(x, -3.5);
  }
  ctx.stroke();
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.ellipse(3.5, -10, 3, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(4.4, -10, 1, 0, Math.PI * 2);
  ctx.fill();
  // Leg and geta.
  ctx.strokeStyle = fill;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(pose === KASA_POSE.air ? 1.5 : 0, pose === KASA_POSE.air ? 6 : 8);
  ctx.stroke();
  ctx.fillRect(-3.5, pose === KASA_POSE.air ? 6 : 8, 7, 2);
  ctx.restore();
}

/** The lantern-bearer: hooded cloak facing +x. The lantern is drawn live. */
function player(ctx: CanvasRenderingContext2D, frame: number): void {
  const bob = frame % 2 === 0 ? 0 : -1;
  const hem = [0, 1.5, 0, -1.5][frame] ?? 0;
  ctx.fillStyle = PALETTE.bone;
  ctx.beginPath();
  // Hood with a forward point.
  ctx.moveTo(-6, -10 + bob);
  ctx.quadraticCurveTo(-6, -20 + bob, 1, -20 + bob);
  ctx.quadraticCurveTo(7, -19 + bob, 8, -12 + bob);
  // Cloak flaring to the hem.
  ctx.quadraticCurveTo(6, -6 + bob, 9 + hem, 13);
  ctx.lineTo(4 + hem, 11);
  ctx.lineTo(0 + hem, 14);
  ctx.lineTo(-4 + hem, 11);
  ctx.lineTo(-10 + hem, 13);
  ctx.quadraticCurveTo(-8, -2 + bob, -6, -10 + bob);
  ctx.closePath();
  ctx.fill();
  // Gold rim on the lantern side: the player is the one figure with light on it.
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Shadowed face opening.
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.ellipse(3.5, -12.5 + bob, 2.6, 3.6, 0.25, 0, Math.PI * 2);
  ctx.fill();
}

/** Paper talisman strip along +x with an ink glyph. */
function ofuda(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PALETTE.bone;
  ctx.fillRect(-8, -3.5, 16, 7);
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(5, 0);
  ctx.moveTo(-2, -2);
  ctx.lineTo(-2, 2);
  ctx.moveTo(2, -2);
  ctx.lineTo(3, 1.5);
  ctx.stroke();
}

function ember(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.7, 0);
  ctx.lineTo(0, r);
  ctx.lineTo(-r * 0.7, 0);
  ctx.closePath();
  ctx.fill();
}

/** Irregular ink splatter: a lobed blob plus flung droplets. */
function splat(ctx: CanvasRenderingContext2D, seed: number, fill: string): void {
  const rng = new Rng(seed);
  ctx.fillStyle = fill;
  ctx.beginPath();
  const lobes = 9;
  for (let i = 0; i <= lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    const r = 7 + rng.range(-2.5, 3.5);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.quadraticCurveTo(Math.cos(a - 0.35) * (r + 3), Math.sin(a - 0.35) * (r + 3), x, y);
  }
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(10, 18);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, rng.range(0.8, 2.2), 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- Cache ------------------------------------------------------------------

export class SpriteCache {
  scale = 0;
  wisp: Sprite[][] = []; // [tint][rotation * WISP_FRAMES + frame]
  walker: Sprite[][] = []; // [tint][mirror * WALKER_FRAMES + frame]
  kasa: Sprite[][] = []; // [tint][mirror * 3 + pose]
  player: Sprite[] = []; // [mirror * PLAYER_FRAMES + frame]
  ofuda: Sprite[] = []; // [rotation]
  ember: Sprite[] = []; // [size]
  decal: Sprite[][] = []; // [tint][variant]

  /** (Re)bake everything for `scale` device px per world unit. */
  build(scale: number): void {
    if (Math.abs(scale - this.scale) < 1e-6) return;
    this.scale = scale;
    const tints: [Tint, string][] = [
      ['bone', PALETTE.bone],
      ['ash', PALETTE.ash],
    ];
    this.wisp = tints.map(([, fill]) => {
      const out: Sprite[] = [];
      for (let r = 0; r < WISP_ROTATIONS; r++) {
        for (let f = 0; f < WISP_FRAMES; f++) {
          out.push(
            bake(scale, 26, 26, (ctx) => {
              ctx.rotate((r / WISP_ROTATIONS) * Math.PI * 2);
              wisp(ctx, f, fill);
            }),
          );
        }
      }
      return out;
    });
    this.walker = tints.map(([, fill]) =>
      mirrored(scale, 16, 24, WALKER_FRAMES, (c, f) => walker(c, f, fill)),
    );
    this.kasa = tints.map(([, fill]) => mirrored(scale, 16, 24, 3, (c, p) => kasa(c, p, fill)));
    this.player = mirrored(scale, 15, 25, PLAYER_FRAMES, (c, f) => player(c, f));
    this.ofuda = [];
    for (let r = 0; r < OFUDA_ROTATIONS; r++) {
      this.ofuda.push(
        bake(scale, 10, 10, (ctx) => {
          ctx.rotate((r / OFUDA_ROTATIONS) * Math.PI * 2);
          ofuda(ctx);
        }),
      );
    }
    this.ember = [3.2, 4.5, 6].map((r) => bake(scale, r + 1, r + 1, (ctx) => ember(ctx, r)));
    this.decal = tints.map(([, fill]) => {
      const out: Sprite[] = [];
      for (let v = 0; v < DECAL_VARIANTS; v++) {
        out.push(bake(scale, 22, 22, (ctx) => splat(ctx, 0xdeca1 + v * 7919, fill)));
      }
      return out;
    });
  }
}

/** Bake `frames` frames facing +x, then the same frames mirrored (facing −x). */
function mirrored(
  scale: number,
  halfW: number,
  halfH: number,
  frames: number,
  draw: (ctx: CanvasRenderingContext2D, frame: number) => void,
): Sprite[] {
  const out: Sprite[] = [];
  for (const mirror of [1, -1]) {
    for (let f = 0; f < frames; f++) {
      out.push(
        bake(scale, halfW, halfH, (ctx) => {
          ctx.scale(mirror, 1);
          draw(ctx, f);
        }),
      );
    }
  }
  return out;
}

/** Index of the pre-rotated variant closest to `angle`. */
export function rotationIndex(angle: number, steps: number): number {
  const i = Math.round((angle / (Math.PI * 2)) * steps);
  return ((i % steps) + steps) % steps;
}
