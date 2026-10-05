import { Rng } from '../sim/rng';
import { PALETTE } from './palette';
import { CHARACTERS } from '../data/characters';
import { inkFinish, type InkOptions, type Motif } from './ink';
import { drawFigure } from './player-art';
import * as shapes from './shapes';

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

export const WISP_FRAMES = 2;
export const WALKER_FRAMES = 4;
export const PLAYER_FRAMES = 4;
export const DECAL_VARIANTS = 6;
/** Hopping Kasa poses. */
export const KASA_POSE = { rest: 0, crouch: 1, air: 2 } as const;

type Tint = 'bone' | 'ash';
type Draw = (ctx: CanvasRenderingContext2D) => void;

function bake(scale: number, halfW: number, halfH: number, draw: Draw, ink?: InkOptions): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(halfW * 2 * scale));
  canvas.height = Math.max(1, Math.ceil(halfH * 2 * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas2D unavailable');
  ctx.setTransform(scale, 0, 0, scale, halfW * scale, halfH * scale);
  draw(ctx);
  if (ink) inkFinish(canvas, scale, ink);
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

/** How an enemy's sprite variants are laid out. */
export interface EnemyArt {
  halfW: number;
  halfH: number;
  frames: number;
  /** 'rotate': 16 rotations × frames (faces away from the player); 'mirror': 2 × frames. */
  layout: 'rotate' | 'mirror';
  draw: (ctx: CanvasRenderingContext2D, frame: number, fill: string) => void;
  /** Woodblock finish (keyline + textile motif); omitted = keyline only. */
  ink?: InkOptions;
}

/** Kimono motif per character (matches the portraits). */
const CHARACTER_MOTIF: Record<string, Motif> = {
  akari: 'sakura',
  ren: 'asanoha',
  tetsu: 'kikko',
  hotaru: 'seigaiha',
  kagerou: 'asanoha',
  ido: 'seigaiha',
};

export const ENEMY_ROTATIONS = 16;
export const LOOK_ROTATIONS = 16;

export const ENEMY_ART: Record<string, EnemyArt> = {
  wisp: {
    halfW: 26,
    halfH: 26,
    frames: WISP_FRAMES,
    layout: 'rotate',
    draw: wisp,
    ink: { thin: 0.5, thick: 1.2 },
  },
  faceless_walker: {
    halfW: 16,
    halfH: 24,
    frames: WALKER_FRAMES,
    layout: 'mirror',
    draw: walker,
    ink: { motif: 'asanoha' },
  },
  hopping_kasa: {
    halfW: 16,
    halfH: 24,
    frames: 3,
    layout: 'mirror',
    draw: kasa,
    ink: { motif: 'kikko', motifAlpha: 0.25, thin: 0.4, thick: 0.9 },
  },
  bride_of_the_reservoir: {
    halfW: 38,
    halfH: 34,
    frames: 2,
    layout: 'mirror',
    draw: shapes.bride,
    ink: { motif: 'sakura', motifAlpha: 0.45, thick: 2.4 },
  },
  drowned: {
    halfW: 20,
    halfH: 26,
    frames: 2,
    layout: 'mirror',
    draw: shapes.drowned,
    ink: { motif: 'seigaiha' },
  },
  carrion_crow: {
    halfW: 15,
    halfH: 15,
    frames: 2,
    layout: 'rotate',
    draw: shapes.crow,
    ink: { thin: 0.4, thick: 1 },
  },
  long_neck: {
    halfW: 38,
    halfH: 34,
    frames: 3,
    layout: 'mirror',
    draw: shapes.longNeck,
    ink: { motif: 'asanoha', thin: 0.4, thick: 0.9 },
  },
  lantern_mouth: {
    halfW: 14,
    halfH: 19,
    frames: 2,
    layout: 'mirror',
    draw: shapes.lanternMouth,
    ink: { thin: 0.5, thick: 1.4 },
  },
  bone_colossus: {
    halfW: 32,
    halfH: 54,
    frames: 2,
    layout: 'mirror',
    draw: shapes.colossus,
    ink: { motif: 'kikko', thin: 0.4, thick: 1 },
  },
  mother_of_lanterns: {
    halfW: 46,
    halfH: 46,
    frames: 2,
    layout: 'mirror',
    draw: shapes.mother,
    ink: { motif: 'seigaiha', motifAlpha: 0.4, thick: 3 },
  },
  stone_lantern: {
    halfW: 12,
    halfH: 18,
    frames: 1,
    layout: 'mirror',
    draw: (ctx) => shapes.stoneLantern(ctx),
    ink: { thin: 0.4, thick: 1 },
  },
  sealed_well: {
    halfW: 20,
    halfH: 16,
    frames: 1,
    layout: 'mirror',
    draw: (ctx) => shapes.sealedWell(ctx),
    ink: { thin: 0.4, thick: 1 },
  },
  lantern_eater: {
    halfW: 26,
    halfH: 24,
    frames: 2,
    layout: 'mirror',
    draw: shapes.lanternEater,
    ink: { motif: 'sakura', thick: 2.4 },
  },
};

/** Rotated projectile looks (16 rotations each, facing +x at index 0). */
const LOOKS: Record<string, { half: number; draw: (ctx: CanvasRenderingContext2D) => void }> = {
  ofuda: { half: 10, draw: ofuda },
  kunai: { half: 11, draw: shapes.kunai },
  crane: { half: 11, draw: shapes.crane },
  chime: { half: 10, draw: shapes.chime },
  koi: { half: 11, draw: (c) => shapes.koi(c) },
  crescent: { half: 34, draw: shapes.crescent },
  dragon: { half: 52, draw: shapes.dragon },
  shot: { half: 6, draw: shapes.shot },
};

/** Unrotated props, possibly with frames. */
const PROPS: Record<
  string,
  { half: number; frames: number; draw: (ctx: CanvasRenderingContext2D, f: number) => void }
> = {
  moth: { half: 10, frames: 2, draw: shapes.moth },
  flame: { half: 15, frames: 3, draw: shapes.flame },
  smoke: { half: 17, frames: 1, draw: shapes.smoke },
  reliquary: { half: 12, frames: 1, draw: shapes.reliquary },
  onigiri: { half: 10, frames: 1, draw: shapes.onigiri },
  coin: { half: 6, frames: 1, draw: shapes.coin },
  stone_lantern: { half: 17, frames: 1, draw: shapes.stoneLantern },
  parasol: { half: 15, frames: 1, draw: shapes.parasol },
  burst_lantern: { half: 16, frames: 1, draw: shapes.burstLantern },
  magatama: { half: 14, frames: 1, draw: shapes.magatama },
  festival_fan: { half: 14, frames: 1, draw: shapes.festivalFan },
};

export class SpriteCache {
  scale = 0;
  /** enemy id → [tint][variant]. */
  enemy = new Map<string, Sprite[][]>();
  player: Sprite[] = []; // [mirror * PLAYER_FRAMES + frame]
  /** Per-character figures, same layout as `player`. */
  players = new Map<string, Sprite[]>();
  /** look → [rotation]. */
  looks = new Map<string, Sprite[]>();
  /** prop → [frame]. */
  props = new Map<string, Sprite[]>();
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
    this.enemy.clear();
    for (const [id, art] of Object.entries(ENEMY_ART)) {
      this.enemy.set(
        id,
        tints.map(([, fill]) => {
          if (art.layout === 'mirror') {
            return mirrored(
              scale,
              art.halfW,
              art.halfH,
              art.frames,
              (c, f) => art.draw(c, f, fill),
              art.ink ?? {},
            );
          }
          const out: Sprite[] = [];
          const half = Math.max(art.halfW, art.halfH);
          for (let r = 0; r < ENEMY_ROTATIONS; r++) {
            for (let f = 0; f < art.frames; f++) {
              out.push(
                bake(
                  scale,
                  half,
                  half,
                  (ctx) => {
                    ctx.rotate((r / ENEMY_ROTATIONS) * Math.PI * 2);
                    art.draw(ctx, f, fill);
                  },
                  art.ink ?? {},
                ),
              );
            }
          }
          return out;
        }),
      );
    }
    this.player = mirrored(scale, 15, 25, PLAYER_FRAMES, (c, f) => player(c, f), {
      motif: 'sakura',
      motifAlpha: 0.3,
    });
    this.players.clear();
    for (const c of CHARACTERS) {
      this.players.set(
        c.id,
        mirrored(scale, 15, 25, PLAYER_FRAMES, (ctx, f) => drawFigure(ctx, c.id, f), {
          motif: CHARACTER_MOTIF[c.id] ?? 'sakura',
          motifAlpha: 0.3,
          // No keyline: it would eat the bone rim on the hair masses.
          thin: 0,
          thick: 0,
        }),
      );
    }
    this.looks.clear();
    for (const [id, look] of Object.entries(LOOKS)) {
      const out: Sprite[] = [];
      for (let r = 0; r < LOOK_ROTATIONS; r++) {
        out.push(
          bake(scale, look.half, look.half, (ctx) => {
            ctx.rotate((r / LOOK_ROTATIONS) * Math.PI * 2);
            look.draw(ctx);
          }),
        );
      }
      this.looks.set(id, out);
    }
    this.props.clear();
    for (const [id, prop] of Object.entries(PROPS)) {
      const out: Sprite[] = [];
      for (let f = 0; f < prop.frames; f++) {
        out.push(bake(scale, prop.half, prop.half, (ctx) => prop.draw(ctx, f)));
      }
      this.props.set(id, out);
    }
    this.ember = [3.2, 4.5, 6, 8].map((r) => bake(scale, r + 1, r + 1, (ctx) => ember(ctx, r)));
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
  ink?: InkOptions,
): Sprite[] {
  const out: Sprite[] = [];
  for (const mirror of [1, -1]) {
    for (let f = 0; f < frames; f++) {
      out.push(
        bake(
          scale,
          halfW,
          halfH,
          (ctx) => {
            ctx.scale(mirror, 1);
            draw(ctx, f);
          },
          ink,
        ),
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
