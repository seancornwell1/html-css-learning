import { ENEMIES, ENEMY_KIND } from '../data/enemies';
import { PLAYER_BASE } from '../data/player';
import { DESPAWN_RADIUS, DT, MAX_ENEMIES, RUN_SECONDS, SPAWN_RADIUS, TICK_RATE } from './constants';
import { EnemyPool } from './enemy-pool';
import { EventQueue } from './events';
import { StateHasher } from './hash';
import type { Intent } from './intent';
import { Rng } from './rng';

export interface SimConfig {
  seed: number;
}

export type RunStatus = 'running' | 'dead' | 'won';

export interface PlayerState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  moveSpeed: number;
  radius: number;
  iframes: number;
  /** Last non-zero move direction (unit vector); weapons aim with it. */
  faceX: number;
  faceY: number;
}

/**
 * The whole game rules. Pure and deterministic: the same seed and the same
 * sequence of intents always produce the same `hash()`.
 */
export class Sim {
  readonly seed: number;
  tick = 0;
  status: RunStatus = 'running';
  readonly player: PlayerState;
  readonly enemies = new EnemyPool(MAX_ENEMIES);
  readonly events = new EventQueue();
  kills = 0;

  private readonly spawnRng: Rng;
  private spawnAccumulator = 0;

  constructor(config: SimConfig) {
    this.seed = config.seed;
    const root = new Rng(config.seed);
    this.spawnRng = root.fork();
    this.player = {
      x: 0,
      y: 0,
      hp: PLAYER_BASE.maxHp,
      maxHp: PLAYER_BASE.maxHp,
      moveSpeed: PLAYER_BASE.moveSpeed,
      radius: PLAYER_BASE.radius,
      iframes: 0,
      faceX: 1,
      faceY: 0,
    };
  }

  /** Seconds of run time elapsed. */
  get time(): number {
    return this.tick / TICK_RATE;
  }

  /** Advance exactly one fixed tick. No-op once the run has ended. */
  step(intent: Intent): void {
    if (this.status !== 'running') return;
    this.tick++;
    this.movePlayer(intent);
    this.spawnEnemies();
    this.moveEnemies();
    this.resolveContacts();

    if (this.player.hp <= 0) {
      this.status = 'dead';
      this.events.push({ type: 'player_died', time: this.time });
    } else if (this.time >= RUN_SECONDS) {
      this.status = 'won';
      this.events.push({ type: 'victory', time: this.time });
    }
  }

  /** Determinism fingerprint of the full sim state. */
  hash(): number {
    const h = new StateHasher();
    h.u32v(this.tick).u32v(this.kills);
    for (const word of this.spawnRng.state()) h.u32v(word);
    h.num(this.spawnAccumulator);
    const p = this.player;
    h.num(p.x).num(p.y).num(p.hp).num(p.iframes).num(p.faceX).num(p.faceY);
    const e = this.enemies;
    h.u32v(e.count);
    for (let i = 0; i < e.count; i++) {
      const s = e.slots[i] as number;
      h.u32v(e.id[s] as number)
        .u32v(e.kind[s] as number)
        .num(e.x[s] as number)
        .num(e.y[s] as number)
        .num(e.hp[s] as number);
    }
    return h.digest();
  }

  private movePlayer(intent: Intent): void {
    const p = this.player;
    let mx = intent.moveX;
    let my = intent.moveY;
    const len = Math.hypot(mx, my);
    if (len > 0.001) {
      p.faceX = mx / len;
      p.faceY = my / len;
    }
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    p.x += mx * p.moveSpeed * DT;
    p.y += my * p.moveSpeed * DT;
    if (p.iframes > 0) p.iframes = Math.max(0, p.iframes - DT);
  }

  /** Placeholder director for M0; the real budget curve lands in M1/M5. */
  private spawnEnemies(): void {
    const t = this.time;
    this.spawnAccumulator += (0.8 + t / 40) * DT;
    while (this.spawnAccumulator >= 1) {
      this.spawnAccumulator -= 1;
      const kind = this.spawnRng.chance(0.7) ? ENEMY_KIND.wisp : ENEMY_KIND.faceless_walker;
      const angle = this.spawnRng.range(0, Math.PI * 2);
      const def = ENEMIES[kind];
      if (!def) continue;
      const x = this.player.x + Math.cos(angle) * SPAWN_RADIUS;
      const y = this.player.y + Math.sin(angle) * SPAWN_RADIUS;
      const slot = this.enemies.spawn(kind, x, y, def.hp);
      if (slot >= 0) {
        this.events.push({
          type: 'enemy_spawned',
          id: this.enemies.id[slot] as number,
          kind,
          x,
          y,
        });
      }
    }
  }

  private moveEnemies(): void {
    const e = this.enemies;
    const px = this.player.x;
    const py = this.player.y;
    for (let i = 0; i < e.count; i++) {
      const s = e.slots[i] as number;
      const def = ENEMIES[e.kind[s] as number];
      if (!def) continue;
      const dx = px - (e.x[s] as number);
      const dy = py - (e.y[s] as number);
      const d = Math.hypot(dx, dy);
      if (d > DESPAWN_RADIUS) {
        // Recycle stragglers onto the opposite side of the spawn ring.
        e.x[s] = px + (dx / d) * SPAWN_RADIUS;
        e.y[s] = py + (dy / d) * SPAWN_RADIUS;
        continue;
      }
      if (d > 0.001) {
        e.x[s] = (e.x[s] as number) + (dx / d) * def.speed * DT;
        e.y[s] = (e.y[s] as number) + (dy / d) * def.speed * DT;
      }
    }
  }

  private resolveContacts(): void {
    const p = this.player;
    if (p.iframes > 0) return;
    const e = this.enemies;
    for (let i = 0; i < e.count; i++) {
      const s = e.slots[i] as number;
      const def = ENEMIES[e.kind[s] as number];
      if (!def) continue;
      const r = def.radius + p.radius;
      const dx = p.x - (e.x[s] as number);
      const dy = p.y - (e.y[s] as number);
      if (dx * dx + dy * dy <= r * r) {
        p.hp = Math.max(0, p.hp - def.contactDamage);
        p.iframes = PLAYER_BASE.iframes;
        this.events.push({ type: 'player_hit', damage: def.contactDamage, hp: p.hp });
        return;
      }
    }
  }
}
