import {
  ENEMIES,
  HOP,
  MAX_ENEMY_RADIUS,
  enemyDamageScale,
  enemyHpScale,
  enemyXpScale,
} from '../data/enemies';
import { PASSIVES } from '../data/passives';
import { PLAYER_BASE } from '../data/player';
import { xpToNext } from '../data/progression';
import { WEAPONS, WEAPON_ID, weaponIndex } from '../data/weapons';
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
import { runDirector, type DirectorState } from './director';
import { EmberPool } from './ember-pool';
import { EnemyPool } from './enemy-pool';
import { EventQueue } from './events';
import { StateHasher } from './hash';
import type { Intent } from './intent';
import { PICKUP, PickupPool, type PickupKind } from './pickup-pool';
import { ProjectilePool } from './projectile-pool';
import { Rng } from './rng';
import { SpatialHash } from './spatial-hash';
import { MIN_DAMAGE, baseStats, type PlayerStats } from './stats';
import {
  evolutionReady,
  legalOptions,
  optionLabel,
  rollChoices,
  unionReady,
  type Loadout,
  type OwnedPassive,
  type OwnedWeapon,
  type UpgradeOption,
} from './upgrades';
import { len2 } from './vec';
import { updateProjectiles, updateWeapons, updateZones } from './weapons';
import { ZonePool } from './zone-pool';

export interface SimConfig {
  seed: number;
  /** Character id (GAME_DESIGN §4). */
  character?: string;
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

export interface Turret {
  weapon: number;
  x: number;
  y: number;
  life: number;
  cooldown: number;
  damage: number;
  pierce: number;
}

/** Knockback velocity kept per tick (exponential decay). */
const KNOCKBACK_DECAY = 0.86;
/** Separation looks at most this many grid candidates per enemy (dense blobs). */
const SEPARATION_CANDIDATES = 24;
/** How hard overlapping enemies push apart (fraction of overlap per tick). */
const SEPARATION = 0.35;
const PICKUP_RADIUS = 16;
const RELIQUARY_HEAL = 30;
const ONIGIRI_HEAL = 30;
const REVIVE_IFRAMES = 2;

/**
 * The whole game rules. Pure and deterministic: the same seed and the same
 * sequence of intents and choices always produce the same `hash()`.
 */
export class Sim {
  readonly seed: number;
  readonly character: string;
  tick = 0;
  status: RunStatus = 'running';
  readonly player: PlayerState;
  readonly stats: PlayerStats;
  readonly weapons: OwnedWeapon[] = [];
  readonly passives: OwnedPassive[] = [];
  /** Base weapons that have evolved (never offered again). */
  readonly retired = new Set<number>();
  readonly enemies = new EnemyPool(MAX_ENEMIES);
  readonly projectiles = new ProjectilePool(MAX_PROJECTILES);
  readonly embers = new EmberPool(MAX_EMBERS);
  readonly zones = new ZonePool(256);
  readonly pickups = new PickupPool(64);
  readonly turrets: Turret[] = [];
  /** Enemy positions, rebuilt every tick. Bots may query it (read-only). */
  readonly enemyGrid = new SpatialHash(MAX_ENEMIES);
  readonly events: EventQueue;
  kills = 0;
  level = 1;
  xp = 0;
  xpNext = xpToNext(1);
  coins = 0;
  /** Upgrade cards waiting for `choose()`. While set, `step()` is paused. */
  choices: UpgradeOption[] | null = null;
  /** Total damage dealt per weapon id (balance reports). */
  readonly damageByWeapon: number[] = WEAPONS.map(() => 0);
  /** Hits landed per weapon id (lifesteal counters). */
  private readonly hitsByWeapon: number[] = WEAPONS.map(() => 0);
  /** Evolutions and unions obtained, with the time they happened. */
  readonly evolutions: { weapon: string; time: number }[] = [];
  revivalsUsed = 0;
  turretReviveUsed = false;

  /** Shared scratch buffer for grid queries (never held across calls). */
  readonly scratch = new Int32Array(MAX_ENEMIES);
  private readonly separationScratch = new Int32Array(SEPARATION_CANDIDATES);

  readonly spawnRng: Rng;
  private readonly upgradeRng: Rng;
  readonly combatRng: Rng;
  private readonly director: DirectorState = { budget: 0, nextKind: -1, nextGroup: 0 };
  private pendingLevels = 0;

  constructor(config: SimConfig) {
    this.seed = config.seed;
    this.character = config.character ?? 'akari';
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
    this.recomputeStats();
    this.player.hp = this.stats.maxHp;
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

  get loadout(): Loadout {
    return { weapons: this.weapons, passives: this.passives, retired: this.retired };
  }

  /** Advance exactly one fixed tick. No-op once ended or while choosing. */
  step(intent: Intent): void {
    if (this.status !== 'running' || this.choices) return;
    this.tick++;
    this.movePlayer(intent);
    runDirector(this, this.director);
    this.moveEnemies();
    this.enemyGrid.build(this.enemies.slots, this.enemies.count, this.enemies.x, this.enemies.y);
    updateWeapons(this);
    updateProjectiles(this);
    updateZones(this);
    this.resolveContacts();
    this.updateEmbers();
    this.updatePickups();
    if (this.stats.regen > 0) this.heal(this.stats.regen * DT);

    if (this.player.hp <= 0 && !this.tryRevive()) {
      this.status = 'dead';
      this.events.push({ type: 'player_died', time: this.time });
    } else if (this.time >= RUN_SECONDS) {
      this.status = 'won';
      this.events.push({ type: 'victory', time: this.time });
    }
    if (this.status === 'running' && this.pendingLevels > 0 && !this.choices) {
      this.choices = rollChoices(this.loadout, this.upgradeRng, this.stats.luck);
    }
  }

  /** Pick upgrade card `index` from `choices`. */
  choose(index: number): void {
    const options = this.choices;
    if (!options) return;
    const option = options[Math.max(0, Math.min(options.length - 1, index))] as UpgradeOption;
    this.applyOption(option);
    this.events.push({ type: 'upgrade_chosen', label: optionLabel(option) });
    this.pendingLevels--;
    this.choices =
      this.pendingLevels > 0 ? rollChoices(this.loadout, this.upgradeRng, this.stats.luck) : null;
  }

  heal(amount: number): void {
    this.player.hp = Math.min(this.stats.maxHp, this.player.hp + amount);
  }

  /** Slow (fraction for `slowTime` s) and/or freeze an enemy. */
  applyStatus(slot: number, slow: number, slowTime: number, freeze: number): void {
    const e = this.enemies;
    if (ENEMIES[e.kind[slot] as number]?.boss) freeze *= 0.25;
    if (slow > 0) {
      const current = (e.slowT[slot] as number) > 0 ? (e.slowAmt[slot] as number) : 0;
      e.slowAmt[slot] = Math.max(current, Math.min(0.8, slow));
      e.slowT[slot] = Math.max(e.slowT[slot] as number, slowTime);
    }
    if (freeze > 0) e.freezeT[slot] = Math.max(e.freezeT[slot] as number, freeze);
  }

  /**
   * Apply weapon damage to an enemy; handles knockback, kill rewards and
   * per-weapon on-hit effects. Returns true if it died.
   */
  damageEnemy(
    slot: number,
    damage: number,
    kbx: number,
    kby: number,
    weapon: number,
    xpBonus = 0,
  ): boolean {
    const e = this.enemies;
    const def = ENEMIES[e.kind[slot] as number];
    if (!def) return false;
    const dealt = Math.min(damage, e.hp[slot] as number);
    this.damageByWeapon[weapon] = (this.damageByWeapon[weapon] ?? 0) + dealt;
    e.hp[slot] = (e.hp[slot] as number) - damage;
    e.kbx[slot] = (e.kbx[slot] as number) + kbx * def.knockback;
    e.kby[slot] = (e.kby[slot] as number) + kby * def.knockback;
    const fx = WEAPONS[weapon]?.effects;
    if (fx?.lifestealEvery) {
      const hits = (this.hitsByWeapon[weapon] ?? 0) + 1;
      this.hitsByWeapon[weapon] = hits;
      if (hits % fx.lifestealEvery === 0) this.heal(1);
    }
    const x = e.x[slot] as number;
    const y = e.y[slot] as number;
    if (this.events.enabled) this.events.push({ type: 'enemy_hit', slot, damage, x, y });
    if ((e.hp[slot] as number) > 0) return false;

    this.kills++;
    this.embers.drop(
      x,
      y,
      (def.xp * enemyXpScale(this.minutes) + xpBonus) * this.stats.curse,
      this.player.x,
      this.player.y,
    );
    if (def.elite || def.boss) this.pickups.drop(PICKUP.reliquary, x, y);
    if (fx?.healPerKill) this.heal(fx.healPerKill);
    if (fx?.foodChance && this.combatRng.chance(fx.foodChance))
      this.pickups.drop(PICKUP.onigiri, x, y);
    if (this.events.enabled) {
      this.events.push({ type: 'enemy_killed', slot, kind: e.kind[slot] as number, x, y });
    }
    e.remove(slot);
    return true;
  }

  /** Spawn one enemy; `force` makes room by recycling the furthest normal enemy. */
  spawnEnemy(kind: number, x: number, y: number, force = false): number {
    const def = ENEMIES[kind];
    if (!def) return -1;
    if (force && this.enemies.count >= this.enemies.capacity) this.evictFurthest();
    const m = this.minutes;
    const curse = this.stats.curse;
    const slot = this.enemies.spawn(
      kind,
      x,
      y,
      def.hp * enemyHpScale(m) * curse,
      def.contactDamage * enemyDamageScale(m),
    );
    if (slot >= 0) {
      this.enemies.speedMul[slot] = 1 + (curse - 1) * 0.5;
      // Desynchronise hoppers so packs don't hop in lockstep.
      this.enemies.timer[slot] = this.spawnRng.range(0, HOP.rest);
      if (this.events.enabled) this.events.push({ type: 'enemy_spawned', slot, kind, x, y });
    }
    return slot;
  }

  /** Determinism fingerprint of the full sim state. */
  hash(): number {
    const h = new StateHasher();
    const d = this.director;
    h.u32v(this.tick).u32v(this.kills).u32v(this.level).num(this.xp).num(d.budget);
    h.u32v(this.pendingLevels).num(d.nextKind).num(d.nextGroup).num(this.coins);
    for (const rng of [this.spawnRng, this.upgradeRng, this.combatRng]) {
      for (const word of rng.state()) h.u32v(word);
    }
    const p = this.player;
    h.num(p.x).num(p.y).num(p.hp).num(p.iframes).num(p.faceX).num(p.faceY);
    for (const w of this.weapons) h.u32v(w.weapon).u32v(w.level).num(w.cooldown).u32v(w.fired);
    for (const ps of this.passives) h.u32v(ps.passive).u32v(ps.level);
    for (const t of this.turrets) h.num(t.x).num(t.y).num(t.life).num(t.cooldown);
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
    const z = this.zones;
    h.u32v(z.count);
    for (let i = 0; i < z.count; i++) {
      const s = z.slots[i] as number;
      h.num(z.x[s] as number).num(z.life[s] as number);
    }
    const em = this.embers;
    h.u32v(em.count);
    for (let i = 0; i < em.count; i++) {
      const s = em.slots[i] as number;
      h.num(em.x[s] as number)
        .num(em.y[s] as number)
        .num(em.value[s] as number);
    }
    const pk = this.pickups;
    h.u32v(pk.count);
    for (let i = 0; i < pk.count; i++) {
      const s = pk.slots[i] as number;
      h.u32v(pk.kind[s] as number).num(pk.x[s] as number);
    }
    return h.digest();
  }

  /**
   * Debug/test loadout: weapons or passives by id at a level (weapons
   * replace the starting one). Used by `?grant=` and tests, never by play.
   */
  grant(items: readonly { id: string; level: number }[]): void {
    let first = true;
    for (const { id, level } of items) {
      const w = WEAPONS.findIndex((d) => d.id === id);
      if (w >= 0) {
        if (first) this.weapons.length = 0;
        first = false;
        if (this.weapons.length < 6) {
          this.weapons.push({ weapon: w, level, cooldown: 0.3, fired: 0, hits: 0, active: 0 });
        }
        continue;
      }
      const p = PASSIVES.findIndex((d) => d.id === id);
      if (p >= 0 && this.passives.length < 6) this.passives.push({ passive: p, level });
    }
    this.recomputeStats();
    this.player.hp = this.stats.maxHp;
  }

  // ---- loadout ----------------------------------------------------------------

  private addWeapon(weapon: number): void {
    this.weapons.push({ weapon, level: 1, cooldown: 0.3, fired: 0, hits: 0, active: 0 });
  }

  private applyOption(option: UpgradeOption): void {
    switch (option.type) {
      case 'weapon_new':
        this.addWeapon(option.weapon);
        break;
      case 'weapon_level': {
        const owned = this.weapons.find((w) => w.weapon === option.weapon);
        if (owned) owned.level = option.toLevel;
        break;
      }
      case 'passive_new':
        this.passives.push({ passive: option.passive, level: 1 });
        break;
      case 'passive_level': {
        const owned = this.passives.find((p) => p.passive === option.passive);
        if (owned) owned.level = option.toLevel;
        break;
      }
      case 'heal':
        this.heal(option.amount);
        break;
    }
    this.recomputeStats();
  }

  /** Rebuild stats from base + passives + weapon effects, keeping lost HP lost. */
  recomputeStats(): void {
    const before = this.stats.maxHp;
    const s = baseStats(PLAYER_BASE.maxHp);
    for (const owned of this.passives) {
      const def = PASSIVES[owned.passive];
      if (!def) continue;
      for (let i = 0; i < owned.level; i++) s[def.stat] += def.perLevel[i] ?? 0;
    }
    for (const w of this.weapons) s.armor += WEAPONS[w.weapon]?.effects?.armor ?? 0;
    s.cooldown = Math.max(0.35, s.cooldown);
    Object.assign(this.stats, s);
    if (this.player) this.player.hp = Math.max(0, this.player.hp + (s.maxHp - before));
  }

  /** Open a Reliquary: evolution, then union, then 1/3/5 random level-ups. */
  private openReliquary(): void {
    const evo = evolutionReady(this.loadout);
    if (evo >= 0) {
      const owned = this.weapons[evo] as OwnedWeapon;
      const base = WEAPONS[owned.weapon];
      if (base?.evolvesInto) {
        const into = weaponIndex(base.evolvesInto);
        this.retired.add(owned.weapon);
        this.weapons[evo] = { weapon: into, level: 1, cooldown: 0.2, fired: 0, hits: 0, active: 0 };
        this.evolutions.push({ weapon: WEAPONS[into]?.id ?? '?', time: this.time });
        this.events.push({ type: 'evolution', weapon: into, union: false });
        this.recomputeStats();
        return;
      }
    }
    const union = unionReady(this.loadout, this.character);
    if (union >= 0) {
      const def = WEAPONS[union];
      if (def?.unionOf) {
        const [a, b] = def.unionOf.map((id) => weaponIndex(id));
        const ia = this.weapons.findIndex((w) => w.weapon === a);
        this.weapons[ia] = { weapon: union, level: 1, cooldown: 0.2, fired: 0, hits: 0, active: 0 };
        this.weapons.splice(
          this.weapons.findIndex((w) => w.weapon === b),
          1,
        );
        this.evolutions.push({ weapon: def.id, time: this.time });
        this.events.push({ type: 'evolution', weapon: union, union: true });
        this.recomputeStats();
        return;
      }
    }
    const luck = this.stats.luck;
    const rolls = this.combatRng.chance(0.03 * luck)
      ? 5
      : this.combatRng.chance(0.15 * luck)
        ? 3
        : 1;
    const rewards: string[] = [];
    for (let i = 0; i < rolls; i++) {
      const pool = legalOptions(this.loadout).filter(
        (o) => o.type === 'weapon_level' || o.type === 'passive_level',
      );
      if (pool.length === 0) {
        this.heal(RELIQUARY_HEAL);
        rewards.push(`Lantern Oil (+${RELIQUARY_HEAL} HP)`);
        continue;
      }
      const pick = pool[Math.floor(this.combatRng.float() * pool.length)] as UpgradeOption;
      this.applyOption(pick);
      rewards.push(optionLabel(pick));
    }
    this.events.push({ type: 'reliquary', rewards });
  }

  private tryRevive(): boolean {
    const p = this.player;
    let revived = false;
    if (this.revivalsUsed < this.stats.revival) {
      this.revivalsUsed++;
      revived = true;
    } else if (!this.turretReviveUsed && this.turrets.length > 0) {
      const t = this.turrets.find((tt) => WEAPONS[tt.weapon]?.effects?.revive);
      if (t) {
        this.turretReviveUsed = true;
        revived = true;
      }
    }
    if (!revived) return false;
    p.hp = this.stats.maxHp * 0.5;
    p.iframes = REVIVE_IFRAMES;
    // Clear a breathing space.
    const n = this.enemyGrid.query(p.x, p.y, 160, this.scratch);
    for (let k = 0; k < n; k++) {
      const s = this.scratch[k] as number;
      if (!this.enemies.isAlive(s)) continue;
      const dx = (this.enemies.x[s] as number) - p.x;
      const dy = (this.enemies.y[s] as number) - p.y;
      const d = len2(dx, dy) || 1;
      this.enemies.kbx[s] = (this.enemies.kbx[s] as number) + (dx / d) * 600;
      this.enemies.kby[s] = (this.enemies.kby[s] as number) + (dy / d) * 600;
    }
    this.events.push({ type: 'revived', x: p.x, y: p.y });
    return true;
  }

  // ---- movement & contact -------------------------------------------------------

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

  private evictFurthest(): void {
    const e = this.enemies;
    let worst = -1;
    let worstD = -1;
    for (let i = 0; i < e.count; i++) {
      const s = e.slots[i] as number;
      const def = ENEMIES[e.kind[s] as number];
      if (def?.elite || def?.boss) continue;
      const d = len2((e.x[s] as number) - this.player.x, (e.y[s] as number) - this.player.y);
      if (d > worstD) {
        worstD = d;
        worst = s;
      }
    }
    if (worst >= 0) e.remove(worst);
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
      // Status effects.
      let speedMul = e.speedMul[s] as number;
      const freeze = e.freezeT[s] as number;
      if (freeze > 0) {
        e.freezeT[s] = freeze - DT;
        speedMul = 0;
      }
      const slowT = e.slowT[s] as number;
      if (slowT > 0) {
        e.slowT[s] = slowT - DT;
        speedMul *= 1 - (e.slowAmt[s] as number);
      }
      // Aim where the player is going: lead grows with distance, so close
      // enemies still home in directly.
      const lead = def.lead * Math.min(1, d / 400);
      dx += p.vx * lead;
      dy += p.vy * lead;
      const dl = len2(dx, dy);
      const ux = dl > 0.001 ? dx / dl : 0;
      const uy = dl > 0.001 ? dy / dl : 0;
      const speed = def.speed * speedMul;
      if (def.behaviour === 'hop') {
        const before = e.timer[s] as number;
        const t = (before + DT * (speedMul > 0 ? 1 : 0)) % hopCycle;
        e.timer[s] = t;
        if (before < HOP.rest && t >= HOP.rest) {
          // Crouch starts: lock heading (the telegraph).
          e.dirX[s] = ux;
          e.dirY[s] = uy;
        }
        if (t >= HOP.rest + HOP.crouch) {
          x += (e.dirX[s] as number) * speed * DT;
          y += (e.dirY[s] as number) * speed * DT;
        }
      } else {
        x += ux * speed * DT;
        y += uy * speed * DT;
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
        // Heavier enemies (low knockback) shove lighter ones aside.
        const push = ((min - dd) / dd) * SEPARATION * Math.min(1, def.knockback * 2);
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
        this.hurtPlayer(e.damage[s] as number);
        return;
      }
    }
  }

  hurtPlayer(raw: number): void {
    const p = this.player;
    if (p.iframes > 0) return;
    const dmg = Math.max(MIN_DAMAGE, raw - this.stats.armor);
    p.hp = Math.max(0, p.hp - dmg);
    p.iframes = PLAYER_BASE.iframes;
    this.events.push({ type: 'player_hit', damage: dmg, hp: p.hp });
  }

  // ---- pickups -----------------------------------------------------------------

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
  }

  private updatePickups(): void {
    const pk = this.pickups;
    const p = this.player;
    const r = p.radius + PICKUP_RADIUS;
    for (let i = pk.count - 1; i >= 0; i--) {
      const s = pk.slots[i] as number;
      const dx = p.x - (pk.x[s] as number);
      const dy = p.y - (pk.y[s] as number);
      if (dx * dx + dy * dy > r * r) continue;
      const kind = pk.kind[s] as PickupKind;
      const x = pk.x[s] as number;
      const y = pk.y[s] as number;
      const value = pk.value[s] as number;
      pk.remove(s);
      this.events.push({ type: 'pickup', kind, x, y });
      this.collect(kind, value);
    }
  }

  private collect(kind: PickupKind, value: number): void {
    switch (kind) {
      case PICKUP.reliquary:
        this.openReliquary();
        break;
      case PICKUP.onigiri:
        this.heal(ONIGIRI_HEAL);
        break;
      case PICKUP.coin:
        this.coins += (value || 1) * this.stats.greed;
        break;
      default:
        break;
    }
  }
}
