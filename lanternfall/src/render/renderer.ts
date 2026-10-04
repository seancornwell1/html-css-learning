import { ENEMIES, ENEMY_KIND, HOP } from '../data/enemies';
import { MAX_ENEMIES, MAX_PROJECTILES } from '../sim/constants';
import type { SimEvent } from '../sim/events';
import type { Sim } from '../sim/sim';
import { Camera } from './camera';
import type { Display } from './display';
import { Decals, HitStop, ScreenFx, Shake, type FxParams } from './effects';
import { GROUND_TILE, bakeGround } from './ground';
import { PALETTE, withAlpha } from './palette';
import {
  DECAL_VARIANTS,
  KASA_POSE,
  OFUDA_ROTATIONS,
  PLAYER_FRAMES,
  SpriteCache,
  WALKER_FRAMES,
  WISP_FRAMES,
  WISP_ROTATIONS,
  rotationIndex,
  type Sprite,
} from './sprites';

const LIGHT_RADIUS = 150;
const HIT_FLASH = 0.08;
const SWEEP_LIFE = 0.18;
const PULSE_LIFE = 0.5;
/** Kills in a single tick that earn a hit-stop. */
const MULTIKILL = 6;
/** A projectile/ember that moved further than this in one tick is new: don't interpolate. */
const TELEPORT = 40;

interface Sweep {
  x: number;
  y: number;
  angle: number;
  radius: number;
  arc: number;
  age: number;
}

/**
 * World renderer (GAME_DESIGN §7). Reads sim state and events only; never
 * writes to the sim. Positions are interpolated between fixed ticks.
 */
export class Renderer {
  readonly camera = new Camera();
  readonly sprites = new SpriteCache();
  readonly shake = new Shake();
  readonly fx = new ScreenFx();
  readonly hitStop = new HitStop();
  private readonly decals = new Decals();
  private ground: HTMLCanvasElement | null = null;
  private readonly fxParams: FxParams = { invert: 0, fade: 0, ca: 0, impact: 0, time: 0 };

  private readonly enemyFlash = new Float32Array(MAX_ENEMIES);
  private readonly prevEX = new Float64Array(MAX_ENEMIES);
  private readonly prevEY = new Float64Array(MAX_ENEMIES);
  private readonly prevEId = new Uint32Array(MAX_ENEMIES);
  private readonly prevPX = new Float64Array(MAX_PROJECTILES);
  private readonly prevPY = new Float64Array(MAX_PROJECTILES);
  private prevX = 0;
  private prevY = 0;
  private killsThisStep = 0;

  private readonly sweeps: Sweep[] = [];
  private pulse = PULSE_LIFE;
  private walkPhase = 0;
  private lanternSwing = 0;
  private time = 0;

  constructor(private readonly display: Display) {
    this.resize();
  }

  set reduceFlashing(value: boolean) {
    this.fx.reduceFlashing = value;
  }

  get reduceFlashing(): boolean {
    return this.fx.reduceFlashing;
  }

  resize(): void {
    this.display.resize();
    this.camera.fit(this.display.width, this.display.height);
    if (Math.abs(this.sprites.scale - this.camera.scale) > 1e-6 || !this.ground) {
      this.sprites.build(this.camera.scale);
      this.ground = bakeGround(this.camera.scale);
    }
  }

  reset(): void {
    this.enemyFlash.fill(0);
    this.sweeps.length = 0;
    this.decals.reset();
    this.shake.reset();
    this.fx.reset();
    this.hitStop.reset();
    this.pulse = PULSE_LIFE;
  }

  /** Call right before `sim.step()` so draws can interpolate. */
  beforeStep(sim: Sim): void {
    this.prevX = sim.player.x;
    this.prevY = sim.player.y;
    const e = sim.enemies;
    for (let i = 0; i < e.count; i++) {
      const s = e.slots[i] as number;
      this.prevEX[s] = e.x[s] as number;
      this.prevEY[s] = e.y[s] as number;
      this.prevEId[s] = e.id[s] as number;
    }
    const p = sim.projectiles;
    for (let i = 0; i < p.count; i++) {
      const s = p.slots[i] as number;
      this.prevPX[s] = p.x[s] as number;
      this.prevPY[s] = p.y[s] as number;
    }
    this.killsThisStep = 0;
  }

  onEvent(e: SimEvent, now: number): void {
    switch (e.type) {
      case 'player_hit':
        this.fx.flash(0.07);
        this.fx.aberration(1);
        this.shake.add(0.35);
        this.hitStop.trigger(60, now);
        break;
      case 'enemy_spawned':
        this.enemyFlash[e.slot] = 0;
        break;
      case 'enemy_hit':
        this.enemyFlash[e.slot] = HIT_FLASH;
        break;
      case 'enemy_killed':
        this.decals.add(e.x, e.y, (ENEMIES[e.kind]?.radius ?? 10) / 9, DECAL_VARIANTS);
        this.shake.add(0.012);
        if (++this.killsThisStep === MULTIKILL) {
          this.hitStop.trigger(30, now);
          this.shake.add(0.1);
        }
        break;
      case 'sweep':
        this.shake.add(0.03);
        if (this.sweeps.length < 16) {
          this.sweeps.push({
            x: e.x,
            y: e.y,
            angle: e.angle,
            radius: e.radius,
            arc: e.arc,
            age: 0,
          });
        }
        break;
      case 'level_up':
        this.pulse = 0;
        this.fx.aberration(0.3);
        break;
      case 'encircle':
        this.fx.impactFrame(0.8);
        this.shake.add(0.5);
        break;
      case 'player_died':
        this.fx.impactFrame(1);
        this.shake.add(0.8);
        this.hitStop.trigger(300, now);
        break;
      case 'victory':
        this.fx.impactFrame(1);
        break;
      default:
        break;
    }
  }

  /** Draw a frame. `alpha` ∈ [0,1] interpolates between the last two ticks. */
  draw(sim: Sim, alpha: number, frameSeconds: number): void {
    const dt = Math.min(frameSeconds, 0.1);
    this.time += dt;
    this.shake.update(dt);
    this.fx.update(dt);
    this.decals.update(dt);

    const { display, camera } = this;
    const ctx = display.ctx;
    const p = sim.player;
    const px = this.prevX + (p.x - this.prevX) * alpha;
    const py = this.prevY + (p.y - this.prevY) * alpha;
    camera.x = px + this.shake.x / camera.scale;
    camera.y = py + this.shake.y / camera.scale;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(0, 0, display.width, display.height);
    this.drawGround();
    this.drawDecals();
    this.drawLight(sim, px, py, dt);
    this.drawEmbers(sim);
    this.drawEnemies(sim, alpha, px, py, dt);
    this.drawSweeps(dt);
    this.drawProjectiles(sim, alpha);
    this.drawPlayer(sim, px, py);
    this.drawPulse(px, py, dt);

    display.present(this.fx.params(this.fxParams));
  }

  // ---- helpers -----------------------------------------------------------

  private sx(x: number): number {
    return (x - this.camera.x) * this.camera.scale + this.display.width / 2;
  }

  private sy(y: number): number {
    return (y - this.camera.y) * this.camera.scale + this.display.height / 2;
  }

  private worldTransform(): void {
    const { camera, display } = this;
    display.ctx.setTransform(
      camera.scale,
      0,
      0,
      camera.scale,
      display.width / 2 - camera.x * camera.scale,
      display.height / 2 - camera.y * camera.scale,
    );
  }

  private blit(sprite: Sprite | undefined, x: number, y: number): void {
    if (!sprite) return;
    this.display.ctx.drawImage(
      sprite.canvas,
      Math.round(this.sx(x) - sprite.ox),
      Math.round(this.sy(y) - sprite.oy),
    );
  }

  // ---- layers ------------------------------------------------------------

  private drawGround(): void {
    const ground = this.ground;
    if (!ground) return;
    const { camera, display } = this;
    const ctx = display.ctx;
    const halfW = display.width / 2 / camera.scale;
    const halfH = display.height / 2 / camera.scale;
    const x0 = Math.floor((camera.x - halfW) / GROUND_TILE) * GROUND_TILE;
    const y0 = Math.floor((camera.y - halfH) / GROUND_TILE) * GROUND_TILE;
    const size = GROUND_TILE * camera.scale;
    for (let x = x0; x < camera.x + halfW; x += GROUND_TILE) {
      for (let y = y0; y < camera.y + halfH; y += GROUND_TILE) {
        // +1 px overlap hides seams from rounding.
        ctx.drawImage(ground, Math.floor(this.sx(x)), Math.floor(this.sy(y)), size + 1, size + 1);
      }
    }
  }

  private drawDecals(): void {
    const d = this.decals;
    const ctx = this.display.ctx;
    const bone = this.sprites.decal[0];
    const ash = this.sprites.decal[1];
    if (!bone || !ash) return;
    for (let i = 0; i < d.age.length; i++) {
      const age = d.age[i] as number;
      if (age >= Decals.LIFE) continue;
      const fresh = age < Decals.FRESH;
      const sprite = (fresh ? bone : ash)[d.variant[i] as number];
      if (!sprite) continue;
      ctx.globalAlpha = fresh
        ? 0.9
        : 0.45 * (1 - (age - Decals.FRESH) / (Decals.LIFE - Decals.FRESH));
      const k = d.size[i] as number;
      const w = sprite.canvas.width * k;
      const h = sprite.canvas.height * k;
      ctx.drawImage(
        sprite.canvas,
        this.sx(d.x[i] as number) - w / 2,
        this.sy(d.y[i] as number) - h / 2,
        w,
        h,
      );
    }
    ctx.globalAlpha = 1;
  }

  private lanternPos(sim: Sim, px: number, py: number): [number, number] {
    const face = sim.player.faceX < 0 ? -1 : 1;
    return [px + face * 13 + this.lanternSwing * 2, py + Math.abs(this.lanternSwing)];
  }

  private drawLight(sim: Sim, px: number, py: number, dt: number): void {
    const p = sim.player;
    const moving = p.vx !== 0 || p.vy !== 0;
    this.walkPhase += dt * (moving ? 9 : 2);
    this.lanternSwing = Math.sin(this.walkPhase * 0.5) * (moving ? 1 : 0.3);
    const [lx, ly] = this.lanternPos(sim, px, py);
    const ctx = this.display.ctx;
    this.worldTransform();
    // Flicker: slow sum of sines (presentation only).
    const flicker = 1 + 0.05 * Math.sin(this.time * 13) + 0.03 * Math.sin(this.time * 7.1);
    const r = LIGHT_RADIUS * flicker;
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
    g.addColorStop(0, withAlpha(PALETTE.gold, 0.3));
    g.addColorStop(0.5, withAlpha(PALETTE.gold, 0.12));
    g.addColorStop(1, withAlpha(PALETTE.gold, 0));
    ctx.fillStyle = g;
    ctx.fillRect(lx - r, ly - r, r * 2, r * 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawEmbers(sim: Sim): void {
    const em = sim.embers;
    const sprites = this.sprites.ember;
    for (let i = 0; i < em.count; i++) {
      const s = em.slots[i] as number;
      const v = em.value[s] as number;
      this.blit(sprites[v >= 10 ? 2 : v >= 3 ? 1 : 0], em.x[s] as number, em.y[s] as number);
    }
  }

  private drawEnemies(sim: Sim, alpha: number, px: number, py: number, dt: number): void {
    const e = sim.enemies;
    const sp = this.sprites;
    for (let i = 0; i < e.count; i++) {
      const s = e.slots[i] as number;
      const kind = e.kind[s] as number;
      const id = e.id[s] as number;
      let x = e.x[s] as number;
      let y = e.y[s] as number;
      if (this.prevEId[s] === id) {
        x = (this.prevEX[s] as number) + (x - (this.prevEX[s] as number)) * alpha;
        y = (this.prevEY[s] as number) + (y - (this.prevEY[s] as number)) * alpha;
      }
      const flashLeft = this.enemyFlash[s] as number;
      if (flashLeft > 0) this.enemyFlash[s] = Math.max(0, flashLeft - dt);
      const tint = flashLeft > 0 ? 1 : 0;
      if (kind === ENEMY_KIND.wisp) {
        const rot = rotationIndex(Math.atan2(y - py, x - px), WISP_ROTATIONS);
        const frame = Math.floor(this.time * 6 + id) % WISP_FRAMES;
        this.blit(sp.wisp[tint]?.[rot * WISP_FRAMES + frame], x, y);
      } else if (kind === ENEMY_KIND.hopping_kasa) {
        const t = e.timer[s] as number;
        const pose =
          t < HOP.rest
            ? KASA_POSE.rest
            : t < HOP.rest + HOP.crouch
              ? KASA_POSE.crouch
              : KASA_POSE.air;
        const mirror = px < x ? 1 : 0;
        // Airborne kasa lift off the ground a little.
        const lift = pose === KASA_POSE.air ? 4 : 0;
        this.blit(sp.kasa[tint]?.[mirror * 3 + pose], x, y - lift);
      } else {
        const mirror = px < x ? 1 : 0;
        const frame = Math.floor(this.time * 5 + id * 0.37) % WALKER_FRAMES;
        this.blit(sp.walker[tint]?.[mirror * WALKER_FRAMES + frame], x, y);
      }
    }
  }

  private drawSweeps(dt: number): void {
    const ctx = this.display.ctx;
    this.worldTransform();
    for (let i = this.sweeps.length - 1; i >= 0; i--) {
      const sw = this.sweeps[i] as Sweep;
      sw.age += dt;
      if (sw.age >= SWEEP_LIFE) {
        this.sweeps.splice(i, 1);
        continue;
      }
      const t = sw.age / SWEEP_LIFE;
      // The lantern's arc of light: a crescent that sweeps across, then fades.
      const start = sw.angle - sw.arc / 2;
      const head = start + sw.arc * Math.min(1, t * 1.8);
      const tail = start + sw.arc * Math.max(0, t * 1.8 - 0.8);
      ctx.fillStyle = withAlpha(PALETTE.gold, 0.9 * (1 - t));
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, tail, head);
      ctx.arc(sw.x, sw.y, sw.radius * 0.62, head, tail, true);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = withAlpha(PALETTE.bone, 1 - t);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, tail, head);
      ctx.stroke();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawProjectiles(sim: Sim, alpha: number): void {
    const pr = sim.projectiles;
    const sprites = this.sprites.ofuda;
    for (let i = 0; i < pr.count; i++) {
      const s = pr.slots[i] as number;
      let x = pr.x[s] as number;
      let y = pr.y[s] as number;
      const ox = this.prevPX[s] as number;
      const oy = this.prevPY[s] as number;
      if (Math.abs(x - ox) < TELEPORT && Math.abs(y - oy) < TELEPORT) {
        x = ox + (x - ox) * alpha;
        y = oy + (y - oy) * alpha;
      }
      const rot = rotationIndex(
        Math.atan2(pr.vy[s] as number, pr.vx[s] as number),
        OFUDA_ROTATIONS,
      );
      this.blit(sprites[rot], x, y);
    }
  }

  private drawPlayer(sim: Sim, px: number, py: number): void {
    const p = sim.player;
    const ctx = this.display.ctx;
    const mirror = p.faceX < 0 ? 1 : 0;
    const frame = Math.floor(this.walkPhase / 2) % PLAYER_FRAMES;
    const hurt = p.iframes > 0;
    // Reduce flashing: translucency instead of a 10 Hz blink.
    if (hurt && this.fx.reduceFlashing) ctx.globalAlpha = 0.55;
    if (!hurt || this.fx.reduceFlashing || Math.floor(p.iframes * 20) % 2 === 1) {
      this.blit(this.sprites.player[mirror * PLAYER_FRAMES + frame], px, py);
    }
    ctx.globalAlpha = 1;

    // Lantern on a short cord: bone cord, gold paper body, ink ribs.
    const [lx, ly] = this.lanternPos(sim, px, py);
    const face = mirror ? -1 : 1;
    this.worldTransform();
    ctx.strokeStyle = PALETTE.bone;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(px + face * 6, py - 4);
    ctx.lineTo(lx, ly - 4);
    ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.ellipse(lx, ly, 5, 6.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(lx - 4.8, ly - 2);
    ctx.lineTo(lx + 4.8, ly - 2);
    ctx.moveTo(lx - 4.8, ly + 2);
    ctx.lineTo(lx + 4.8, ly + 2);
    ctx.stroke();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawPulse(px: number, py: number, dt: number): void {
    if (this.pulse >= PULSE_LIFE) return;
    this.pulse += dt;
    const t = Math.min(1, this.pulse / PULSE_LIFE);
    const ctx = this.display.ctx;
    this.worldTransform();
    ctx.strokeStyle = withAlpha(PALETTE.gold, 1 - t);
    ctx.lineWidth = 3 * (1 - t) + 0.5;
    ctx.beginPath();
    ctx.arc(px, py, 20 + t * 120, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
