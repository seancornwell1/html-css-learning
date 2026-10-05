import { ENEMIES, HOP } from '../data/enemies';
import { SECRETS } from '../data/secrets';
import { WEAPONS } from '../data/weapons';
import { STATE } from '../sim/enemy-ai';
import { HAZARD } from '../sim/hazard-pool';
import { MODE } from '../sim/projectile-pool';
import { PICKUP } from '../sim/pickup-pool';
import { MAX_ENEMIES, MAX_PROJECTILES } from '../sim/constants';
import type { SimEvent } from '../sim/events';
import type { Sim } from '../sim/sim';
import { Camera } from './camera';
import type { Display } from './display';
import { Decals, HitStop, ScreenFx, Shake, type FxParams } from './effects';
import { GROUND_TILE, bakeGround } from './ground';
import { PALETTE, PRINT, withAlpha } from './palette';
import {
  DECAL_VARIANTS,
  ENEMY_ART,
  ENEMY_ROTATIONS,
  KASA_POSE,
  LOOK_ROTATIONS,
  PLAYER_FRAMES,
  SpriteCache,
  bake,
  rotationIndex,
  type Sprite,
} from './sprites';
import { PROJECTILE_LOOK, WeaponFx } from './weapon-fx';

const LIGHT_RADIUS = 150;
const HIT_FLASH = 0.08;
const PULSE_LIFE = 0.5;
/** Kills in a single tick that earn a hit-stop. */
const MULTIKILL = 6;
/** A projectile/ember that moved further than this in one tick is new: don't interpolate. */
const TELEPORT = 40;

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
  private readonly fxParams: FxParams = {
    invert: 0,
    fade: 0,
    ca: 0,
    impact: 0,
    time: 0,
    frenzy: 0,
  };

  private readonly enemyFlash = new Float32Array(MAX_ENEMIES);
  private readonly prevEX = new Float64Array(MAX_ENEMIES);
  private readonly prevEY = new Float64Array(MAX_ENEMIES);
  private readonly prevEId = new Uint32Array(MAX_ENEMIES);
  private readonly prevPX = new Float64Array(MAX_PROJECTILES);
  private readonly prevPY = new Float64Array(MAX_PROJECTILES);
  private prevX = 0;
  private prevY = 0;
  private killsThisStep = 0;

  private readonly weaponFx = new WeaponFx();
  /** Called with a headline and detail line for evolutions and reliquaries. */
  onBanner: (title: string, detail: string) => void = () => undefined;
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
    this.cutIn = null;
    this.enemyFlash.fill(0);
    this.weaponFx.reset();
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
    this.weaponFx.onEvent(e);
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
      case 'whip':
        this.shake.add(0.03);
        break;
      case 'nova':
        this.shake.add(0.12);
        break;
      case 'strike':
        this.shake.add(0.04);
        break;
      case 'evolution': {
        this.fx.impactFrame(1);
        this.shake.add(0.6);
        this.hitStop.trigger(180, now);
        const name = WEAPONS[e.weapon]?.name ?? '';
        this.onBanner(e.union ? 'Union' : 'Evolution', name);
        break;
      }
      case 'reliquary':
        this.fx.aberration(0.4);
        this.onBanner('Reliquary', e.rewards.join(' · '));
        break;
      case 'revived':
        this.fx.impactFrame(0.8);
        this.shake.add(0.6);
        this.onBanner('Revived', 'The paper doll burns in your place');
        break;
      case 'elite':
        this.shake.add(0.25);
        this.fx.aberration(0.5);
        break;
      case 'boss': {
        this.fx.impactFrame(1);
        this.shake.add(0.7);
        this.hitStop.trigger(160, now);
        const def = ENEMIES[e.kind];
        if (def && !def.invulnerable) this.cutIn = { id: def.id, name: def.name, age: 0 };
        else this.onBanner('It comes', def?.name ?? '');
        break;
      }
      case 'boss_slain':
        this.fx.impactFrame(1);
        this.shake.add(0.8);
        this.hitStop.trigger(250, now);
        this.onBanner('Laid to rest', ENEMIES[e.kind]?.name ?? '');
        break;
      case 'slam':
        this.shake.add(0.45);
        break;
      case 'dash':
        this.fx.aberration(0.35);
        break;
      case 'procession':
        this.onBanner('The Procession', 'Something is crossing');
        break;
      case 'long_night':
        this.fx.impactFrame(0.6);
        this.onBanner('The Long Night', 'Dawn will not come again');
        break;
      case 'pickup':
        if (e.kind === PICKUP.lantern_burst) {
          this.fx.impactFrame(1);
          this.shake.add(0.6);
          this.hitStop.trigger(120, now);
          this.onBanner('Lantern Burst', 'The dark is swept away');
        } else if (e.kind === PICKUP.spirit_call) {
          this.fx.aberration(0.5);
          this.onBanner('Spirit Call', 'Every ember comes home');
        } else if (e.kind === PICKUP.frenzy) {
          this.fx.impactFrame(0.6);
          this.onBanner('Festival Night', 'Faster, fiercer, for a while');
        }
        break;
      case 'flood':
        this.fx.impactFrame(0.7);
        this.shake.add(0.5);
        this.onBanner('The Flood', 'Black water rises');
        break;
      case 'secret': {
        const def = SECRETS.find((x) => x.id === e.id);
        this.fx.impactFrame(0.5);
        this.onBanner('A secret', def?.reveal ?? '');
        break;
      }
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
    this.fx.setFrenzy(sim.frenzy > 0);
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
    this.worldTransform();
    this.drawHazards(sim);
    this.weaponFx.drawGround(display.ctx, sim, this.sprites, this.blitScaled, dt);
    display.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawEnemies(sim, alpha, px, py, dt);
    this.drawProjectiles(sim, alpha);
    this.worldTransform();
    this.drawEnemyShots(sim);
    this.weaponFx.drawEffects(display.ctx, dt);
    display.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawPlayer(sim, px, py);
    this.drawPulse(px, py, dt);
    this.drawCutIn(dt);

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
    for (let i = 0; i < e.count; i++) {
      const s = e.slots[i] as number;
      const kind = e.kind[s] as number;
      const def = ENEMIES[kind];
      if (!def) continue;
      const art = ENEMY_ART[def.id];
      const sprites = this.sprites.enemy.get(def.id);
      if (!art || !sprites) continue;
      const id = e.id[s] as number;
      let x = e.x[s] as number;
      let y = e.y[s] as number;
      if (this.prevEId[s] === id) {
        x = (this.prevEX[s] as number) + (x - (this.prevEX[s] as number)) * alpha;
        y = (this.prevEY[s] as number) + (y - (this.prevEY[s] as number)) * alpha;
      }
      const flashLeft = this.enemyFlash[s] as number;
      if (flashLeft > 0) this.enemyFlash[s] = Math.max(0, flashLeft - dt);
      const tinted = sprites[flashLeft > 0 ? 1 : 0];
      let frame = Math.floor(this.time * 5 + id * 0.37) % art.frames;
      let lift = 0;
      if (def.behaviour === 'hop') {
        const t = e.timer[s] as number;
        frame =
          t < HOP.rest
            ? KASA_POSE.rest
            : t < HOP.rest + HOP.crouch
              ? KASA_POSE.crouch
              : KASA_POSE.air;
        // Airborne kasa lift off the ground a little.
        lift = frame === KASA_POSE.air ? 4 : 0;
      }
      // Telegraph poses come from the behaviour state.
      const st = e.state[s] as number;
      if (def.behaviour === 'lunge') frame = st === STATE.windup ? 1 : st === STATE.act ? 2 : 0;
      else if (def.behaviour === 'ranged' || def.behaviour === 'colossus') {
        frame = st === STATE.windup ? 1 : 0;
      } else if (def.behaviour === 'mother') frame = st !== STATE.move ? 1 : 0;
      // Frozen enemies stop animating.
      if ((e.freezeT[s] as number) > 0) frame = 0;
      let index: number;
      if (art.layout === 'rotate') {
        // Flyers face where they fly; wisps trail away from the player.
        const angle =
          def.behaviour === 'flank'
            ? Math.atan2(e.dirY[s] as number, e.dirX[s] as number)
            : Math.atan2(y - py, x - px);
        const rot = rotationIndex(angle, ENEMY_ROTATIONS);
        index = rot * art.frames + frame;
      } else {
        index = (px < x ? 1 : 0) * art.frames + frame;
      }
      this.blit(tinted?.[index], x, y - lift);
    }
  }

  private drawProjectiles(sim: Sim, alpha: number): void {
    const pr = sim.projectiles;
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
      const weaponId = WEAPONS[pr.weapon[s] as number]?.id ?? '';
      let look = PROJECTILE_LOOK[weaponId] ?? 'ofuda';
      if (look === 'koi' && (pr.radius[s] as number) > 30) look = 'dragon';
      if ((pr.mode[s] as number) === MODE.turret) look = 'shot';
      if (look.startsWith('prop:')) {
        const frames = this.sprites.props.get(look.slice(5));
        const f = frames && frames.length > 1 ? Math.floor(this.time * 12 + s) % frames.length : 0;
        this.blit(frames?.[f], x, y);
        continue;
      }
      // Orbit/boomerang velocities aren't stored as headings; aim along motion.
      const vx =
        (pr.mode[s] as number) === MODE.straight || (pr.mode[s] as number) >= MODE.ricochet
          ? (pr.vx[s] as number)
          : x - ox;
      const vy =
        (pr.mode[s] as number) === MODE.straight || (pr.mode[s] as number) >= MODE.ricochet
          ? (pr.vy[s] as number)
          : y - oy;
      const rot = rotationIndex(Math.atan2(vy, vx), LOOK_ROTATIONS);
      this.blit(this.sprites.looks.get(look)?.[rot], x, y);
    }
  }

  /** Puddles and telegraphed slams (world transform set). */
  private drawHazards(sim: Sim): void {
    const ctx = this.display.ctx;
    const h = sim.hazards;
    for (let i = 0; i < h.count; i++) {
      const s = h.slots[i] as number;
      const x = h.x[s] as number;
      const y = h.y[s] as number;
      const r = h.radius[s] as number;
      if (h.kind[s] === HAZARD.puddle) {
        const fade = Math.min(1, (h.life[s] as number) / 1);
        ctx.fillStyle = withAlpha(PALETTE.ink2, 0.9 * fade);
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = withAlpha(PALETTE.ash, 0.5 * fade);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(
          x,
          y,
          r * (0.6 + 0.4 * ((this.time * 0.8 + s) % 1)),
          r * 0.36,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        continue;
      }
      // Slam telegraph: a dashed ring with a fill that closes in as it charges.
      const delay = h.delay[s] as number;
      if (delay <= 0) continue;
      const progress = 1 - delay / Math.max(h.total[s] as number, 0.01);
      ctx.strokeStyle = withAlpha(PALETTE.bone, 0.7);
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = withAlpha(PALETTE.ash, 0.25 + 0.25 * progress);
      ctx.beginPath();
      ctx.arc(x, y, r * progress, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Enemy orbs: bone cores with an ash halo; reflected ones turn gold (yours now). */
  private drawEnemyShots(sim: Sim): void {
    const ctx = this.display.ctx;
    const sh = sim.enemyShots;
    for (let i = 0; i < sh.count; i++) {
      const s = sh.slots[i] as number;
      const x = sh.x[s] as number;
      const y = sh.y[s] as number;
      const r = sh.radius[s] as number;
      ctx.fillStyle = withAlpha(PALETTE.ash, 0.45);
      ctx.beginPath();
      ctx.arc(x, y, r * 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = sh.reflected[s] ? PALETTE.gold : PALETTE.bone;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Draw a sprite at a world position with an optional scale (resets transform). */
  private blitScaled = (sprite: Sprite | undefined, x: number, y: number, scale: number): void => {
    if (!sprite) return;
    const ctx = this.display.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const w = sprite.canvas.width * scale;
    const h = sprite.canvas.height * scale;
    ctx.drawImage(
      sprite.canvas,
      this.sx(x) - sprite.ox * scale,
      this.sy(y) - sprite.oy * scale,
      w,
      h,
    );
    this.worldTransform();
  };

  private drawPlayer(sim: Sim, px: number, py: number): void {
    const p = sim.player;
    const ctx = this.display.ctx;
    const mirror = p.faceX < 0 ? 1 : 0;
    const frame = Math.floor(this.walkPhase / 2) % PLAYER_FRAMES;
    const hurt = p.iframes > 0;
    // Reduce flashing: translucency instead of a 10 Hz blink.
    if (hurt && this.fx.reduceFlashing) ctx.globalAlpha = 0.55;
    if (!hurt || this.fx.reduceFlashing || Math.floor(p.iframes * 20) % 2 === 1) {
      const frames = this.sprites.players.get(sim.character) ?? this.sprites.player;
      this.blit(frames[mirror * PLAYER_FRAMES + frame], px, py);
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

  /** Boss intro: an anime cut-in band slashing across the screen. */
  private cutIn: { id: string; name: string; age: number; art?: Sprite } | null = null;

  private drawCutIn(dt: number): void {
    const c = this.cutIn;
    if (!c) return;
    c.age += dt;
    const life = 1.9;
    if (c.age >= life) {
      this.cutIn = null;
      return;
    }
    const ctx = this.display.ctx;
    const { width: w, height: h } = this.display;
    // Slide in fast, hold, slide out.
    const t = c.age;
    const slide =
      t < 0.22 ? 1 - (t / 0.22) ** 2 : t > life - 0.3 ? -(((t - (life - 0.3)) / 0.3) ** 2) : 0;
    const bandH = Math.min(h * 0.34, w * (h > w ? 0.62 : 0.42));
    // Boss on the left, name to its right; tighter on narrow screens.
    const bossX = -Math.min(bandH * 0.9, w * 0.3);
    const bossH = bandH * (h > w ? 0.95 : 1.15);
    if (!c.art) {
      // Bake the boss at cut-in size: sharp, not an upscaled play sprite.
      const art = ENEMY_ART[c.id];
      if (art) {
        const k = bossH / (art.halfH * 2);
        c.art = bake(k, art.halfW, art.halfH, (g) => art.draw(g, 0, PALETTE.bone), art.ink ?? {});
      }
    }
    ctx.save();
    ctx.translate(w / 2 + slide * w * 1.1, h * 0.46);
    ctx.rotate(-0.14);
    const bw = Math.hypot(w, h) * 1.2;
    ctx.fillStyle = withAlpha(PALETTE.ink, 0.94);
    ctx.fillRect(-bw / 2, -bandH / 2, bw, bandH);
    // Speed lines racing through the band.
    ctx.strokeStyle = withAlpha(PALETTE.ash, 0.5);
    ctx.lineWidth = Math.max(1, bandH * 0.01);
    for (let i = 0; i < 26; i++) {
      const y = -bandH / 2 + (((i * 37) % 100) / 100) * bandH;
      const len = bw * (0.08 + ((i * 53) % 10) / 60);
      const x = ((i * 211 + t * bw * 1.6) % bw) - bw / 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - len, y);
      ctx.stroke();
    }
    // Bone edges, like the border lines of a print panel.
    ctx.fillStyle = PALETTE.bone;
    ctx.fillRect(-bw / 2, -bandH / 2, bw, Math.max(2, bandH * 0.025));
    ctx.fillRect(-bw / 2, bandH / 2 - Math.max(2, bandH * 0.025), bw, Math.max(2, bandH * 0.025));
    // The boss, huge.
    const sprite = c.art;
    if (sprite) {
      const s = 1;
      ctx.drawImage(
        sprite.canvas,
        bossX - sprite.canvas.width * s * 0.5,
        -sprite.canvas.height * s * 0.52,
        sprite.canvas.width * s,
        sprite.canvas.height * s,
      );
    }
    // Name with a vermilion seal.
    const textX = bossX + bandH * 0.55;
    // Fit the name between the boss and the screen edge, one line if it
    // fits, otherwise a word per line (narrow portrait screens).
    const name = c.name.toUpperCase();
    let size = Math.round(bandH * 0.2);
    ctx.font = `700 ${size}px 'Shippori Mincho', serif`;
    const room = w * 0.47 - textX - size * 1.6;
    let lines = [name];
    if (ctx.measureText(name).width > room) lines = name.split(' ');
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest > room) size = Math.max(10, Math.floor((size * room) / widest));
    size = Math.min(size, Math.floor((bandH * 0.62) / lines.length));
    const top = -((lines.length - 1) * size * 1.05) / 2 + size * 0.2;
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.round(size * 0.42)}px 'Shippori Mincho', serif`;
    ctx.fillStyle = PALETTE.ash;
    ctx.fillText('IT COMES', textX, top - size * 1.05);
    ctx.font = `700 ${size}px 'Shippori Mincho', serif`;
    ctx.fillStyle = PALETTE.bone;
    lines.forEach((line, i) => ctx.fillText(line, textX, top + i * size * 1.05));
    const last = lines[lines.length - 1] ?? '';
    const tw = ctx.measureText(last).width;
    const sy = top + (lines.length - 1) * size * 1.05 - size * 0.45;
    ctx.fillStyle = PRINT.shu;
    ctx.fillRect(textX + tw + size * 0.4, sy, size * 0.9, size * 0.9);
    ctx.fillStyle = PRINT.washi;
    ctx.fillRect(textX + tw + size * 0.75, sy + size * 0.15, size * 0.2, size * 0.6);
    ctx.restore();
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
