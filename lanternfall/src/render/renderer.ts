import { ENEMIES, ENEMY_KIND, HOP } from '../data/enemies';
import { MAX_ENEMIES } from '../sim/constants';
import type { SimEvent } from '../sim/events';
import type { Sim } from '../sim/sim';
import { Camera } from './camera';
import { PALETTE, withAlpha } from './palette';

const MAX_DPR = 2;
const GRID = 64;
const LIGHT_RADIUS = 140;
const HIT_FLASH = 0.08;
const SWEEP_LIFE = 0.16;
const BURST_LIFE = 0.25;

interface Sweep {
  x: number;
  y: number;
  angle: number;
  radius: number;
  arc: number;
  age: number;
}

interface Burst {
  x: number;
  y: number;
  r: number;
  age: number;
}

/**
 * Canvas2D world renderer. Placeholder silhouettes for M1; the procedural
 * silhouette pipeline and WebGL post-FX arrive in M2. Reads sim state and
 * events only; never writes to the sim.
 */
export class Renderer {
  readonly camera = new Camera();
  private readonly ctx: CanvasRenderingContext2D;
  /** Seconds of player-hit inversion remaining. */
  private hitFlash = 0;
  /** Per-enemy-slot hit flash timers. */
  private readonly enemyFlash = new Float32Array(MAX_ENEMIES);
  private readonly sweeps: Sweep[] = [];
  private readonly bursts: Burst[] = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas2D unavailable');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.camera.fit(w, h);
  }

  reset(): void {
    this.hitFlash = 0;
    this.enemyFlash.fill(0);
    this.sweeps.length = 0;
    this.bursts.length = 0;
  }

  onEvent(e: SimEvent): void {
    switch (e.type) {
      case 'player_hit':
        this.hitFlash = HIT_FLASH;
        break;
      case 'enemy_spawned':
        this.enemyFlash[e.slot] = 0;
        break;
      case 'enemy_hit':
        this.enemyFlash[e.slot] = HIT_FLASH;
        break;
      case 'enemy_killed':
        if (this.bursts.length < 64) {
          this.bursts.push({ x: e.x, y: e.y, r: ENEMIES[e.kind]?.radius ?? 10, age: 0 });
        }
        break;
      case 'sweep':
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
      default:
        break;
    }
  }

  draw(sim: Sim, frameSeconds: number): void {
    const { ctx, canvas, camera } = this;
    const dt = Math.min(frameSeconds, 0.1);
    const inverted = this.hitFlash > 0;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    const bg = inverted ? PALETTE.bone : PALETTE.ink;
    const fg = inverted ? PALETTE.ink : PALETTE.bone;

    camera.x = sim.player.x;
    camera.y = sim.player.y;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(
      camera.scale,
      0,
      0,
      camera.scale,
      canvas.width / 2 - camera.x * camera.scale,
      canvas.height / 2 - camera.y * camera.scale,
    );

    this.drawGround(inverted);
    this.drawLight(sim);
    this.drawBursts(dt);
    this.drawEmbers(sim);
    this.drawEnemies(sim, fg, dt);
    this.drawSweeps(fg, dt);
    this.drawProjectiles(sim, fg);
    this.drawPlayer(sim, fg);
  }

  private drawGround(inverted: boolean): void {
    const { ctx, canvas, camera } = this;
    const halfW = canvas.width / 2 / camera.scale;
    const halfH = canvas.height / 2 / camera.scale;
    const x0 = Math.floor((camera.x - halfW) / GRID) * GRID;
    const y0 = Math.floor((camera.y - halfH) / GRID) * GRID;
    ctx.fillStyle = inverted ? PALETTE.ash : PALETTE.ink2;
    for (let x = x0; x <= camera.x + halfW; x += GRID) {
      for (let y = y0; y <= camera.y + halfH; y += GRID) {
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
    }
  }

  private drawLight(sim: Sim): void {
    const { ctx } = this;
    const p = sim.player;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, LIGHT_RADIUS);
    g.addColorStop(0, withAlpha(PALETTE.gold, 0.16));
    g.addColorStop(1, withAlpha(PALETTE.gold, 0));
    ctx.fillStyle = g;
    ctx.fillRect(p.x - LIGHT_RADIUS, p.y - LIGHT_RADIUS, LIGHT_RADIUS * 2, LIGHT_RADIUS * 2);
  }

  private drawBursts(dt: number): void {
    const { ctx } = this;
    ctx.lineWidth = 2;
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i] as Burst;
      b.age += dt;
      if (b.age >= BURST_LIFE) {
        this.bursts.splice(i, 1);
        continue;
      }
      const t = b.age / BURST_LIFE;
      ctx.strokeStyle = withAlpha(PALETTE.ash, 1 - t);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * (1 + t * 1.5), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawEmbers(sim: Sim): void {
    const { ctx } = this;
    const em = sim.embers;
    ctx.fillStyle = PALETTE.gold;
    for (let i = 0; i < em.count; i++) {
      const s = em.slots[i] as number;
      const v = em.value[s] as number;
      const r = v >= 10 ? 6 : v >= 3 ? 4.5 : 3.2;
      const x = em.x[s] as number;
      const y = em.y[s] as number;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.7, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 0.7, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawEnemies(sim: Sim, fg: string, dt: number): void {
    const { ctx } = this;
    const e = sim.enemies;
    for (let i = 0; i < e.count; i++) {
      const s = e.slots[i] as number;
      const kind = e.kind[s] as number;
      const def = ENEMIES[kind];
      if (!def) continue;
      const flash = (this.enemyFlash[s] as number) > 0;
      if (flash) this.enemyFlash[s] = Math.max(0, (this.enemyFlash[s] as number) - dt);
      ctx.fillStyle = flash ? PALETTE.ash : fg;
      const x = e.x[s] as number;
      const y = e.y[s] as number;
      const r = def.radius;
      ctx.beginPath();
      if (kind === ENEMY_KIND.wisp) {
        // Teardrop whose tail trails away from the player.
        const a = Math.atan2(y - sim.player.y, x - sim.player.x);
        ctx.arc(x, y, r * 0.75, a + Math.PI / 2, a - Math.PI / 2);
        ctx.lineTo(x + Math.cos(a) * r * 1.6, y + Math.sin(a) * r * 1.6);
      } else if (kind === ENEMY_KIND.hopping_kasa) {
        // Umbrella dome on one leg; squashes while crouching (the telegraph).
        const t = e.timer[s] as number;
        const crouch = t >= HOP.rest && t < HOP.rest + HOP.crouch;
        const sy = crouch ? 0.7 : 1;
        ctx.ellipse(x, y - r * 0.2 * sy, r * 1.15, r * 0.8 * sy, 0, Math.PI, 0);
        ctx.rect(x - 1.2, y - r * 0.2 * sy, 2.4, r * 0.95 * sy);
      } else {
        // Faceless walker: tall oval.
        ctx.ellipse(x, y, r * 0.72, r * 1.05, 0, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  private drawSweeps(fg: string, dt: number): void {
    const { ctx } = this;
    for (let i = this.sweeps.length - 1; i >= 0; i--) {
      const sw = this.sweeps[i] as Sweep;
      sw.age += dt;
      if (sw.age >= SWEEP_LIFE) {
        this.sweeps.splice(i, 1);
        continue;
      }
      const t = sw.age / SWEEP_LIFE;
      // The blade travels across the arc, leaving a fading crescent.
      const start = sw.angle - sw.arc / 2;
      const head = start + sw.arc * Math.min(1, t * 1.6);
      ctx.fillStyle = fg === PALETTE.bone ? withAlpha(PALETTE.bone, 0.85 * (1 - t)) : fg;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, start, head);
      ctx.arc(sw.x, sw.y, sw.radius * 0.72, head, start, true);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawProjectiles(sim: Sim, fg: string): void {
    const { ctx } = this;
    const pr = sim.projectiles;
    ctx.fillStyle = fg;
    for (let i = 0; i < pr.count; i++) {
      const s = pr.slots[i] as number;
      const a = Math.atan2(pr.vy[s] as number, pr.vx[s] as number);
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const x = pr.x[s] as number;
      const y = pr.y[s] as number;
      // Paper talisman: a 14×7 strip along the flight direction.
      ctx.setTransform(
        this.camera.scale * cos,
        this.camera.scale * sin,
        -this.camera.scale * sin,
        this.camera.scale * cos,
        this.canvas.width / 2 + (x - this.camera.x) * this.camera.scale,
        this.canvas.height / 2 + (y - this.camera.y) * this.camera.scale,
      );
      ctx.fillRect(-7, -3.5, 14, 7);
    }
    ctx.setTransform(
      this.camera.scale,
      0,
      0,
      this.camera.scale,
      this.canvas.width / 2 - this.camera.x * this.camera.scale,
      this.canvas.height / 2 - this.camera.y * this.camera.scale,
    );
  }

  private drawPlayer(sim: Sim, fg: string): void {
    const { ctx } = this;
    const p = sim.player;
    const blink = p.iframes > 0 && Math.floor(p.iframes * 20) % 2 === 0;
    if (!blink) {
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    // The lantern: the one gold thing the player carries.
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(p.x + p.faceX * 16, p.y + p.faceY * 16, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}
