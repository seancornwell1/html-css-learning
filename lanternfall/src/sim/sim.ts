import { ENEMIES, HOP, MAX_ENEMY_RADIUS, enemyDamageScale, enemyHpScale } from '../data/enemies';
import { DIRECTOR } from '../data/director';
import { PLAYER_BASE } from '../data/player';
import { xpToNext } from '../data/progression';
import { TIMELINE_EVENTS, segmentAt } from '../data/timeline';
import { WEAPONS, WEAPON_ID } from '../data/weapons';
import {
  DESPAWN_RADIUS,
  DT,
  MAX_EMBERS,
  MAX_ENEMIES,
  MAX_PROJECTILES,
  RUN_SECONDS,
  SPAWN_RADIUS,
  TICK_RATE,
} from './constants';
import { EmberPool } from './ember-pool';
import { EnemyPool } from './enemy-pool';
import { EventQueue } from './events';
import { StateHasher } from './hash';
import type { Intent } from './intent';
import { ProjectilePool } from './projectile-pool';
import { Rng } from './rng';
import { SpatialHash } from './spatial-hash';
import { MIN_DAMAGE, baseStats, type PlayerStats } from './stats';
import { rollChoices, optionLabel, type OwnedWeapon, type UpgradeOption } from './upgrades';
import { updateProjectiles, updateWeapons } from './weapons';
import { len2 } from './vec';

export interface SimConfig {
  seed: number;
  /** Emit presentation events (default true). Headless runs turn this off. */
  events?: boolean;
}

export type RunStatus = 'running' | 'dead' | 'won';

export interface PlayerState {
  x: number;
  y: number;
  hp: number;
  radius: number;
  iframes: number;
  /** Last non-zero move direction (unit vector); weapons aim with it. */
  faceX: number;
  faceY: number;
  /** Current velocity, px/s (bots and renderer read it). */
  vx: number;
  vy: number;
}

/** Knockback velocity kept per tick (exponential decay). */
const KNOCKBACK_DECAY = 0.86;
/** Separation looks at most this many grid candidates per enemy (dense blobs). */
const SEPARATION_CANDIDATES = 24;
/** How hard overlapping enemies push apart (fraction of overlap per tick). */
const SEPARATION = 0.35;

/**
 * The whole game rules. Pure and deterministic: the same seed and the same
 * sequence of intents and choices always produce the same `hash()`.
 */
export class Sim {
  readonly seed: number;
  tick = 0;
  status: RunStatus = 'running';
  readonly player: PlayerState;
  readonly stats: PlayerStats;
  readonly weapons: OwnedWeapon[] = [];
  readonly enemies = new EnemyPool(MAX_ENEMIES);
  readonly projectiles = new ProjectilePool(MAX_PROJECTILES);
  readonly embers = new EmberPool(MAX_EMBERS);
  /** Enemy positions, rebuilt every tick. Bots may query it (read-only). */
  readonly enemyGrid = new SpatialHash(MAX_ENEMIES);
  readonly events: EventQueue;
  kills = 0;
  level = 1;
  xp = 0;
  xpNext = xpToNext(1);
  /** Upgrade cards waiting for `choose()`. While set, `step()` is paused. */
  choices: UpgradeOption[] | null = null;
  /** Total damage dealt per weapon id (balance reports). */
  readonly damageByWeapon: number[] = WEAPONS.map(() => 0);

  /** Shared scratch buffer for grid queries (never held across calls). */
  readonly scratch = new Int32Array(MAX_ENEMIES);
  private readonly separationScratch = new Int32Array(SEPARATION_CANDIDATES);

  private readonly spawnRng: Rng;
  private readonly upgradeRng: Rng;
  readonly combatRng: Rng;
  private budget = 0;
  private pendingLevels = 0;
  private nextKind = -1;
  private nextGroup = 0;

  constructor(config: SimConfig) {
    this.seed = config.seed;
    this.events = new EventQueue(config.events ?? true);
    const root = new Rng(config.seed);
    this.spawnRng = root.fork();
    this.upgradeRng = root.fork();
    this.combatRng = root.fork();
    this.stats = baseStats(PLAYER_BASE.maxHp);
    this.player = {
      x: 0,
      y: 0,
      hp: this.stats.maxHp,
      radius: PLAYER_BASE.radius,
      iframes: 0,
      faceX: 1,
      faceY: 0,
      vx: 0,
      vy: 0,
    };
    this.addWeapon(WEAPON_ID.lantern_flail);
  }

  /** Seconds of run time elapsed. */
  get time(): number {
    return this.tick / TICK_RATE;
  }

  get minutes(): number {
    return this.time / 60;
  }

  get moveSpeed(): number {
    return PLAYER_BASE.moveSpeed * this.stats.moveSpeed;
  }

  get magnetRadius(): number {
    return PLAYER_BASE.pickupRadius * this.stats.magnet;
  }

  /** Advance exactly one fixed tick. No-op once ended or while choosing. */
  step(intent: Intent): void {
    if (this.status !== 'running' || this.choices) return;
    this.tick++;
    this.movePlayer(intent);
    this.runDirector();
    this.moveEnemies();
    this.enemyGrid.build(this.enemies.slots, this.enemies.count, this.enemies.x, this.enemies.y);
    updateWeapons(this);
    updateProjectiles(this);
    this.resolveContacts();
    this.updateEmbers();
    if (this.stats.regen > 0) {
      this.player.hp = Math.min(this.stats.maxHp, this.player.hp + this.stats.regen * DT);
    }

    if (this.player.hp <= 0) {
      this.status = 'dead';
      this.events.push({ type: 'player_died', time: this.time });
    } else if (this.time >= RUN_SECONDS) {
      this.status = 'won';
      this.events.push({ type: 'victory', time: this.time });
    }
  }

  /** Pick upgrade card `index` from `choices`. */
  choose(index: number): void {
    const options = this.choices;
    if (!options) return;
    const option = options[Math.max(0, Math.min(options.length - 1, index))] as UpgradeOption;
    switch (option.type) {
      case 'weapon_new':
        this.addWeapon(option.weapon);
        break;
      case 'weapon_level': {
        const owned = this.weapons.find((w) => w.weapon === option.weapon);
        if (owned) owned.level = option.toLevel;
        break;
      }
      case 'heal':
        this.player.hp = Math.min(this.stats.maxHp, this.player.hp + option.amount);
        break;
    }
    this.events.push({ type: 'upgrade_chosen', label: optionLabel(option) });
    this.pendingLevels--;
    this.choices = this.pendingLevels > 0 ? rollChoices(this.weapons, this.upgradeRng) : null;
  }

  /** Apply weapon damage to an enemy; handles knockback and death. */
  damageEnemy(slot: number, damage: number, kbx: number, kby: number, weapon: number): void {
    const e = this.enemies;
    const def = ENEMIES[e.kind[slot] as number];
    if (!def) return;
    const dealt = Math.min(damage, e.hp[slot] as number);
    this.damageByWeapon[weapon] = (this.damageByWeapon[weapon] ?? 0) + dealt;
    e.hp[slot] = (e.hp[slot] as number) - damage;
    e.kbx[slot] = (e.kbx[slot] as number) + kbx * def.knockback;
    e.kby[slot] = (e.kby[slot] as number) + kby * def.knockback;
    const x = e.x[slot] as number;
    const y = e.y[slot] as number;
    if (this.events.enabled) this.events.push({ type: 'enemy_hit', slot, damage, x, y });
    if ((e.hp[slot] as number) <= 0) {
      this.kills++;
      this.embers.drop(x, y, def.xp);
      if (this.events.enabled) {
        this.events.push({ type: 'enemy_killed', slot, kind: e.kind[slot] as number, x, y });
      }
      e.remove(slot);
    }
  }

  /** Determinism fingerprint of the full sim state. */
  hash(): number {
    const h = new StateHasher();
    h.u32v(this.tick).u32v(this.kills).u32v(this.level).num(this.xp).num(this.budget);
    h.u32v(this.pendingLevels).num(this.nextKind).num(this.nextGroup);
    for (const rng of [this.spawnRng, this.upgradeRng, this.combatRng]) {
      for (const word of rng.state()) h.u32v(word);
    }
    const p = this.player;
    h.num(p.x).num(p.y).num(p.hp).num(p.iframes).num(p.faceX).num(p.faceY);
    for (const w of this.weapons) h.u32v(w.weapon).u32v(w.level).num(w.cooldown).u32v(w.fired);
    const e = this.enemies;
    h.u32v(e.count);
    for (let i = 0; i < e.count; i++) {
      const s = e.slots[i] as number;
      h.u32v(e.id[s] as number)
        .num(e.x[s] as number)
        .num(e.y[s] as number)
        .num(e.hp[s] as number)
        .num(e.timer[s] as number);
    }
    const pr = this.projectiles;
    h.u32v(pr.count);
    for (let i = 0; i < pr.count; i++) {
      const s = pr.slots[i] as number;
      h.num(pr.x[s] as number)
        .num(pr.y[s] as number)
        .num(pr.life[s] as number);
    }
    const em = this.embers;
    h.u32v(em.count);
    for (let i = 0; i < em.count; i++) {
      const s = em.slots[i] as number;
      h.num(em.x[s] as number)
        .num(em.y[s] as number)
        .num(em.value[s] as number);
    }
    return h.digest();
  }

  private addWeapon(weapon: number): void {
    this.weapons.push({ weapon, level: 1, cooldown: 0.3, fired: 0 });
  }

  private movePlayer(intent: Intent): void {
    const p = this.player;
    let mx = intent.moveX;
    let my = intent.moveY;
    const len = len2(mx, my);
    if (len > 0.001) {
      p.faceX = mx / len;
      p.faceY = my / len;
    }
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    p.vx = mx * this.moveSpeed;
    p.vy = my * this.moveSpeed;
    p.x += p.vx * DT;
    p.y += p.vy * DT;
    if (p.iframes > 0) p.iframes = Math.max(0, p.iframes - DT);
  }

  private runDirector(): void {
    const seg = segmentAt(this.time);
    this.budget += seg.budget * this.stats.curse * DT;
    let spawned = 0;
    while (spawned < DIRECTOR.maxSpawnsPerTick) {
      if (this.nextKind < 0) this.rollNextGroup(seg.kinds);
      const def = ENEMIES[this.nextKind];
      if (!def) break;
      const cost = def.cost * this.nextGroup;
      const starving = this.enemies.count < seg.minAlive;
      if (!starving && this.budget < cost) break;
      if (!starving) this.budget -= cost;
      spawned += this.spawnGroup(this.nextKind, this.nextGroup);
      this.nextKind = -1;
      if (this.enemies.count >= this.enemies.capacity) break;
    }
    for (const ev of TIMELINE_EVENTS) {
      if (Math.round(ev.at * TICK_RATE) === this.tick) this.encircle(ev.kind, ev.count);
    }
  }

  private rollNextGroup(kinds: readonly { kind: number; weight: number }[]): void {
    let total = 0;
    for (const k of kinds) total += k.weight;
    let r = this.spawnRng.float() * total;
    let kind = kinds[0]?.kind ?? 0;
    for (const k of kinds) {
      r -= k.weight;
      if (r < 0) {
        kind = k.kind;
        break;
      }
    }
    const def = ENEMIES[kind];
    this.nextKind = kind;
    this.nextGroup = def ? this.spawnRng.int(def.group[0], def.group[1]) : 1;
  }

  /** Spawn a pack on the ring outside the view, often ahead of the player. */
  private spawnGroup(kind: number, size: number): number {
    const p = this.player;
    const rng = this.spawnRng;
    const ahead = rng.chance(DIRECTOR.spawnAheadChance) && (p.vx !== 0 || p.vy !== 0);
    const angle = ahead
      ? Math.atan2(p.faceY, p.faceX) + rng.range(-Math.PI / 2, Math.PI / 2)
      : rng.range(0, Math.PI * 2);
    const cx = p.x + Math.cos(angle) * SPAWN_RADIUS;
    const cy = p.y + Math.sin(angle) * SPAWN_RADIUS;
    let n = 0;
    for (let i = 0; i < size; i++) {
      const x = cx + rng.range(-40, 40) + Math.cos(angle) * i * 6;
      const y = cy + rng.range(-40, 40) + Math.sin(angle) * i * 6;
      if (this.spawnEnemy(kind, x, y) >= 0) n++;
    }
    return n;
  }

  private encircle(kind: number, count: number): void {
    const p = this.player;
    const r = DIRECTOR.encircleRadius;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.spawnEnemy(kind, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
    }
    this.events.push({ type: 'encircle', kind });
  }

  private spawnEnemy(kind: number, x: number, y: number): number {
    const def = ENEMIES[kind];
    if (!def) return -1;
    const m = this.minutes;
    const slot = this.enemies.spawn(
      kind,
      x,
      y,
      def.hp * enemyHpScale(m),
      def.contactDamage * enemyDamageScale(m),
    );
    if (slot >= 0) {
      // Desynchronise hoppers so packs don't hop in lockstep.
      this.enemies.timer[slot] = this.spawnRng.range(0, HOP.rest);
      if (this.events.enabled) this.events.push({ type: 'enemy_spawned', slot, kind, x, y });
    }
    return slot;
  }

  private moveEnemies(): void {
    const e = this.enemies;
    const p = this.player;
    const hopCycle = HOP.crouch + HOP.air + HOP.rest;
    // Separation uses last tick's grid (positions one tick stale; fine).
    this.enemyGrid.build(e.slots, e.count, e.x, e.y);
    for (let i = 0; i < e.count; i++) {
      const s = e.slots[i] as number;
      const def = ENEMIES[e.kind[s] as number];
      if (!def) continue;
      let x = e.x[s] as number;
      let y = e.y[s] as number;
      let dx = p.x - x;
      let dy = p.y - y;
      const d = len2(dx, dy);
      if (d > DESPAWN_RADIUS) {
        // Recycle stragglers onto the spawn ring ahead of the player.
        const a = Math.atan2(p.faceY, p.faceX) + this.spawnRng.range(-1, 1);
        e.x[s] = p.x + Math.cos(a) * SPAWN_RADIUS;
        e.y[s] = p.y + Math.sin(a) * SPAWN_RADIUS;
        continue;
      }
      // Aim where the player is going: lead grows with distance, so close
      // enemies still home in directly.
      const lead = def.lead * Math.min(1, d / 400);
      dx += p.vx * lead;
      dy += p.vy * lead;
      const dl = len2(dx, dy);
      const ux = dl > 0.001 ? dx / dl : 0;
      const uy = dl > 0.001 ? dy / dl : 0;
      if (def.behaviour === 'hop') {
        const before = e.timer[s] as number;
        const t = (before + DT) % hopCycle;
        e.timer[s] = t;
        if (before < HOP.rest && t >= HOP.rest) {
          // Crouch starts: lock heading (the telegraph).
          e.dirX[s] = ux;
          e.dirY[s] = uy;
        }
        if (t >= HOP.rest + HOP.crouch) {
          x += (e.dirX[s] as number) * def.speed * DT;
          y += (e.dirY[s] as number) * def.speed * DT;
        }
      } else {
        x += ux * def.speed * DT;
        y += uy * def.speed * DT;
      }
      x += (e.kbx[s] as number) * DT;
      y += (e.kby[s] as number) * DT;
      e.kbx[s] = (e.kbx[s] as number) * KNOCKBACK_DECAY;
      e.kby[s] = (e.kby[s] as number) * KNOCKBACK_DECAY;

      // Push apart from overlapping neighbours.
      const near = this.separationScratch;
      const n = this.enemyGrid.query(x, y, def.radius + MAX_ENEMY_RADIUS, near);
      let checked = 0;
      for (let k = 0; k < n && checked < 8; k++) {
        const o = near[k] as number;
        if (o === s) continue;
        const od = ENEMIES[e.kind[o] as number];
        if (!od) continue;
        const ox = x - (e.x[o] as number);
        const oy = y - (e.y[o] as number);
        const min = def.radius + od.radius;
        const d2 = ox * ox + oy * oy;
        if (d2 >= min * min || d2 < 1e-9) continue;
        checked++;
        const dd = Math.sqrt(d2);
        const push = ((min - dd) / dd) * SEPARATION;
        x += ox * push;
        y += oy * push;
      }
      e.x[s] = x;
      e.y[s] = y;
    }
  }

  private resolveContacts(): void {
    const p = this.player;
    if (p.iframes > 0) return;
    const e = this.enemies;
    const n = this.enemyGrid.query(p.x, p.y, p.radius + MAX_ENEMY_RADIUS, this.scratch);
    for (let k = 0; k < n; k++) {
      const s = this.scratch[k] as number;
      if (!e.isAlive(s)) continue;
      const def = ENEMIES[e.kind[s] as number];
      if (!def) continue;
      const r = def.radius + p.radius;
      const dx = p.x - (e.x[s] as number);
      const dy = p.y - (e.y[s] as number);
      if (dx * dx + dy * dy <= r * r) {
        const dmg = Math.max(MIN_DAMAGE, (e.damage[s] as number) - this.stats.armor);
        p.hp = Math.max(0, p.hp - dmg);
        p.iframes = PLAYER_BASE.iframes;
        this.events.push({ type: 'player_hit', damage: dmg, hp: p.hp });
        return;
      }
    }
  }

  private updateEmbers(): void {
    const em = this.embers;
    const p = this.player;
    const magnet = this.magnetRadius;
    const collect = p.radius + 6;
    for (let i = em.count - 1; i >= 0; i--) {
      const s = em.slots[i] as number;
      const dx = p.x - (em.x[s] as number);
      const dy = p.y - (em.y[s] as number);
      const d = len2(dx, dy);
      if (d <= collect) {
        const value = em.value[s] as number;
        this.xp += value * this.stats.growth;
        em.remove(s);
        if (this.events.enabled) this.events.push({ type: 'ember_collected', value });
        continue;
      }
      if (!em.attracted[s] && d <= magnet) {
        em.attracted[s] = 1;
        em.speed[s] = 120;
      }
      if (em.attracted[s]) {
        const sp = (em.speed[s] as number) + 1100 * DT;
        em.speed[s] = sp;
        const stepLen = Math.min(d, sp * DT);
        em.x[s] = (em.x[s] as number) + (dx / d) * stepLen;
        em.y[s] = (em.y[s] as number) + (dy / d) * stepLen;
      }
    }
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = xpToNext(this.level);
      this.pendingLevels++;
      this.events.push({ type: 'level_up', level: this.level });
    }
    if (this.pendingLevels > 0 && !this.choices) {
      this.choices = rollChoices(this.weapons, this.upgradeRng);
    }
  }
}
