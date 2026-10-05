import {
  EXORCISM,
  FLUTTER,
  GRAVE_HUNGER,
  LANTERNLIGHT,
  NO_FACE,
  UNDERTOW,
  characterDef,
  type CharacterDef,
} from '../data/characters';
import {
  ENEMIES,
  ENEMY_KIND,
  HOP,
  MAX_ENEMY_RADIUS,
  enemyDamageScale,
  enemyHpScale,
  enemyXpScale,
} from '../data/enemies';
import { SHRINE, type MetaRanks } from '../data/meta';
import { PASSIVES } from '../data/passives';
import {
  COIN_POUCH,
  FRENZY,
  LANTERN_BURST,
  LANTERN_DROPS,
  ONIGIRI_HEAL,
  SECRET_RULES,
  STONE_LANTERN,
  type LanternDrop,
} from '../data/powerups';
import { PLAYER_BASE } from '../data/player';
import { xpToNext } from '../data/progression';
import { WEAPONS, weaponIndex } from '../data/weapons';
import {
  DT,
  MAX_EMBERS,
  MAX_ENEMIES,
  MAX_PROJECTILES,
  RUN_SECONDS,
  SPAWN_RADIUS,
  TICK_RATE,
  VIEW_LONG,
} from './constants';
import { moveEnemies, updateEnemyShots, updateHazards } from './enemy-ai';
import { EnemyShotPool } from './enemy-shot-pool';
import { HazardPool } from './hazard-pool';
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
import { ARMOR_CAP, MIN_DAMAGE, baseStats, type PlayerStats } from './stats';
import {
  evolutionReady,
  legalOptions,
  optionItem,
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
  /** Shrine ranks bought (GAME_DESIGN §9.1), by rank id. */
  meta?: MetaRanks;
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

/** The Lantern-Eater arrives this long into the Long Night. */
const LONG_NIGHT_REAPER = 30;
const PICKUP_RADIUS = 16;
const RELIQUARY_HEAL = 30;
const REVIVE_IFRAMES = 2;
/** Damage source for non-weapon damage (Lantern Burst). */
const NO_WEAPON = -1;
/** Lantern Burst reach: half the long side of the fixed view. */
const BURST_RADIUS = VIEW_LONG / 2;

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
  readonly enemyShots = new EnemyShotPool(512);
  readonly hazards = new HazardPool(128);
  /** Fraction of move speed lost to puddles this tick (set by hazards). */
  playerSlow = 0;
  readonly characterDef: CharacterDef;
  /** Hotaru's dash: cooldown left, time left, direction. */
  dashCooldown = 0;
  dashTime = 0;
  private dashX = 0;
  private dashY = 0;
  private killsSinceHeal = 0;
  /** After Dawn, the player chose to keep going (GAME_DESIGN §3.1). */
  longNight = false;
  private reaperSpawned = false;
  /** The Mother of Lanterns was slain before Dawn. */
  motherSlain = false;
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
  /** Frenzy: Festival Night, seconds left (GAME_DESIGN §7.2). */
  frenzy = 0;
  readonly meta: MetaRanks;
  /** Run tools left (Shrine: Recast, Patience, Exile). */
  rerolls = 0;
  skips = 0;
  banishes = 0;
  readonly banished = new Set<string>();
  /** Secrets found this run (GAME_DESIGN §9.2), in order. */
  readonly secrets: string[] = [];
  /** Kagerou's condition: any healing from Onigiri or regen breaks it. */
  private mended = false;
  /** Seconds of Sealed Well flood left; outlasting it reveals Ido. */
  flood = 0;
  private wellPlaced = false;
  private nextBlink = 0;
  private floodsDone = 0;
  private nextLantern: number = STONE_LANTERN.first;
  /** Power-ups and pickups collected, by pickup kind (balance reports). */
  readonly collected: number[] = [0, 0, 0, 0, 0, 0];

  /** Shared scratch buffer for grid queries (never held across calls). */
  readonly scratch = new Int32Array(MAX_ENEMIES);

  readonly spawnRng: Rng;
  private readonly upgradeRng: Rng;
  readonly combatRng: Rng;
  /** Stone lantern placement and drops (its own stream, GAME_DESIGN §7.2). */
  private readonly propRng: Rng;
  private readonly director: DirectorState = { budget: 0, nextKind: -1, nextGroup: 0 };
  private pendingLevels = 0;

  constructor(config: SimConfig) {
    this.seed = config.seed;
    this.character = config.character ?? 'akari';
    this.characterDef = characterDef(this.character);
    this.meta = config.meta ?? {};
    this.rerolls = this.meta.reroll ?? 0;
    this.skips = this.meta.skip ?? 0;
    this.banishes = this.meta.banish ?? 0;
    this.nextBlink = NO_FACE.blinkEvery;
    this.events = new EventQueue(config.events ?? true);
    const root = new Rng(config.seed);
    this.spawnRng = root.fork();
    this.upgradeRng = root.fork();
    this.combatRng = root.fork();
    this.propRng = root.fork();
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
    this.addWeapon(weaponIndex(this.characterDef.startWeapon));
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
    return PLAYER_BASE.moveSpeed * this.stats.moveSpeed * (this.frenzy > 0 ? FRENZY.moveSpeed : 1);
  }

  get magnetRadius(): number {
    return PLAYER_BASE.pickupRadius * this.stats.magnet;
  }

  get loadout(): Loadout {
    return {
      weapons: this.weapons,
      passives: this.passives,
      retired: this.retired,
      banished: this.banished,
    };
  }

  /** Advance exactly one fixed tick. No-op once ended or while choosing. */
  step(intent: Intent): void {
    if (this.status !== 'running' || this.choices) return;
    this.tick++;
    // Regen first: healing after damage would let a lethal hit be undone by
    // a few hundredths of HP before the death check.
    if (this.stats.regen > 0 && this.player.hp > 0) {
      this.heal(this.stats.regen * DT);
      this.mended = true;
    }
    if (this.frenzy > 0) this.frenzy = Math.max(0, this.frenzy - DT);
    this.movePlayer(intent);
    runDirector(this, this.director);
    moveEnemies(this);
    this.enemyGrid.build(this.enemies.slots, this.enemies.count, this.enemies.x, this.enemies.y);
    updateWeapons(this);
    updateProjectiles(this);
    updateZones(this);
    updateEnemyShots(this);
    updateHazards(this);
    this.resolveContacts();
    this.updateEmbers();
    this.updatePickups();
    this.placeLanterns();
    this.updateSecrets();
    this.updateInnates();

    if (this.player.hp <= 0 && !this.tryRevive()) {
      this.status = 'dead';
      this.events.push({ type: 'player_died', time: this.time });
    } else if (!this.longNight && (this.time >= RUN_SECONDS || this.motherSlain)) {
      this.status = 'won';
      this.events.push({ type: 'victory', time: this.time });
    }
    if (this.longNight && !this.reaperSpawned && this.time >= RUN_SECONDS + LONG_NIGHT_REAPER) {
      this.reaperSpawned = true;
      const a = this.spawnRng.range(0, Math.PI * 2);
      const p = this.player;
      this.spawnEnemy(
        ENEMY_KIND.lantern_eater,
        p.x + Math.cos(a) * SPAWN_RADIUS,
        p.y + Math.sin(a) * SPAWN_RADIUS,
        true,
      );
      this.events.push({ type: 'boss', kind: ENEMY_KIND.lantern_eater });
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

  /** Shrine run tool: redraw the current cards. */
  reroll(): boolean {
    if (!this.choices || this.rerolls <= 0) return false;
    this.rerolls--;
    this.choices = rollChoices(this.loadout, this.upgradeRng, this.stats.luck);
    return true;
  }

  /** Shrine run tool: pass on this level-up. */
  skip(): boolean {
    if (!this.choices || this.skips <= 0) return false;
    this.skips--;
    this.pendingLevels--;
    this.choices =
      this.pendingLevels > 0 ? rollChoices(this.loadout, this.upgradeRng, this.stats.luck) : null;
    return true;
  }

  /** Shrine run tool: remove card `index`'s item from the run, then redraw. */
  banish(index: number): boolean {
    const options = this.choices;
    if (!options || this.banishes <= 0) return false;
    const option = options[Math.max(0, Math.min(options.length - 1, index))] as UpgradeOption;
    if (option.type === 'heal') return false;
    this.banishes--;
    this.banished.add(optionItem(option));
    this.choices = rollChoices(this.loadout, this.upgradeRng, this.stats.luck);
    return true;
  }

  /** After Dawn: keep playing into the Long Night (the Lantern-Eater comes). */
  continueLongNight(): void {
    if (this.status !== 'won') return;
    this.status = 'running';
    this.longNight = true;
    this.events.push({ type: 'long_night' });
  }

  /** Bosses alive (the director eases off while one lives). */
  get bossesAlive(): number {
    const e = this.enemies;
    let n = 0;
    for (let i = 0; i < e.count; i++) {
      const def = ENEMIES[e.kind[e.slots[i] as number] as number];
      if (def?.boss && !def.invulnerable) n++;
    }
    return n;
  }

  spawnEnemyShot(
    x: number,
    y: number,
    angle: number,
    speed: number,
    radius: number,
    damage: number,
    life: number,
  ): void {
    const dmg = damage * enemyDamageScale(this.minutes);
    this.enemyShots.spawn(
      x,
      y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      radius,
      dmg,
      life,
    );
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
    if (!def || def.invulnerable) return false;
    damage *= this.innateDamage(slot, def.elite === true || def.boss === true);
    const dealt = Math.min(damage, e.hp[slot] as number);
    if (weapon >= 0) this.damageByWeapon[weapon] = (this.damageByWeapon[weapon] ?? 0) + dealt;
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
    if (def.behaviour === 'prop') {
      if (def.persistent) {
        // The Sealed Well: the Drowned pour out (Ido's secret).
        this.flood = SECRET_RULES.floodSeconds;
        this.events.push({ type: 'flood' });
      } else {
        this.breakLantern(x, y);
      }
      if (this.events.enabled) {
        this.events.push({ type: 'enemy_killed', slot, kind: e.kind[slot] as number, x, y });
      }
      e.remove(slot);
      return true;
    }

    this.kills++;
    if (
      this.characterDef.innate === 'grave_hunger' &&
      ++this.killsSinceHeal >= GRAVE_HUNGER.killsPerHp
    ) {
      this.killsSinceHeal = 0;
      this.heal(1);
    }
    if (def.id === 'mother_of_lanterns' && !this.longNight) {
      this.motherSlain = true;
      if (this.time < SECRET_RULES.dawnEarlyBefore) this.findSecret('dawn_early');
    }
    if (def.boss) this.events.push({ type: 'boss_slain', kind: e.kind[slot] as number });
    this.embers.drop(
      x,
      y,
      (def.xp * enemyXpScale(this.minutes) + xpBonus) * this.stats.curse,
      this.player.x,
      this.player.y,
    );
    if (def.elite || def.boss) {
      this.pickups.drop(PICKUP.reliquary, x, y);
      this.pickups.drop(PICKUP.coin, x + 14, y, COIN_POUCH[1]);
    }
    if (fx?.healPerKill) this.heal(fx.healPerKill);
    if (fx?.foodChance && this.combatRng.chance(fx.foodChance))
      this.pickups.drop(PICKUP.onigiri, x, y);
    if (this.events.enabled) {
      this.events.push({ type: 'enemy_killed', slot, kind: e.kind[slot] as number, x, y });
    }
    e.remove(slot);
    return true;
  }

  /** Character damage multipliers (Lanternlight, Exorcism). */
  private innateDamage(slot: number, eliteOrBoss: boolean): number {
    const innate = this.characterDef.innate;
    if (innate === 'lanternlight') {
      const r =
        LANTERNLIGHT.radius * (1 + LANTERNLIGHT.growthPer10Levels * Math.floor(this.level / 10));
      const dx = (this.enemies.x[slot] as number) - this.player.x;
      const dy = (this.enemies.y[slot] as number) - this.player.y;
      return dx * dx + dy * dy <= r * r ? LANTERNLIGHT.damage : 1;
    }
    if (innate === 'exorcism' && eliteOrBoss) return EXORCISM.damage;
    return 1;
  }

  /** Light radius of Lanternlight (renderer reads it too). */
  get lightRadius(): number {
    return LANTERNLIGHT.radius * (1 + LANTERNLIGHT.growthPer10Levels * Math.floor(this.level / 10));
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
      def.hp * (def.boss ? 1 : enemyHpScale(m)) * curse,
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
    h.num(this.frenzy).num(this.nextLantern).num(this.flood);
    h.u32v(this.rerolls).u32v(this.skips).u32v(this.banishes).u32v(this.secrets.length);
    for (const rng of [this.spawnRng, this.upgradeRng, this.combatRng, this.propRng]) {
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
    h.num(this.dashCooldown).num(this.dashTime).num(this.playerSlow);
    const sh = this.enemyShots;
    h.u32v(sh.count);
    for (let i = 0; i < sh.count; i++) {
      const k = sh.slots[i] as number;
      h.num(sh.x[k] as number).num(sh.y[k] as number);
    }
    const hz = this.hazards;
    h.u32v(hz.count);
    for (let i = 0; i < hz.count; i++) {
      const k = hz.slots[i] as number;
      h.num(hz.x[k] as number).num(hz.delay[k] as number);
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
    for (const [k, v] of Object.entries(this.characterDef.mods) as [keyof PlayerStats, number][]) {
      s[k] += v;
    }
    for (const owned of this.passives) {
      const def = PASSIVES[owned.passive];
      if (!def) continue;
      for (let i = 0; i < owned.level; i++) s[def.stat] += def.perLevel[i] ?? 0;
    }
    for (const w of this.weapons) s.armor += WEAPONS[w.weapon]?.effects?.armor ?? 0;
    for (const rank of SHRINE) {
      const n = this.meta?.[rank.id] ?? 0;
      if (rank.stat && n > 0) s[rank.stat] += rank.perRank * Math.min(n, rank.maxRank);
    }
    if (this.characterDef.fixedMaxHp) s.maxHp = this.characterDef.fixedMaxHp;
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
    const speed = this.moveSpeed * (1 - this.playerSlow);
    p.vx = mx * speed;
    p.vy = my * speed;
    if (this.dashCooldown > 0) this.dashCooldown -= DT;
    if (
      intent.action &&
      this.characterDef.innate === 'flutter' &&
      this.dashCooldown <= 0 &&
      this.dashTime <= 0
    ) {
      // Dash where you're steering, else where you face.
      this.dashX = len > 0.001 ? mx / Math.max(len2(mx, my), 1e-9) : p.faceX;
      this.dashY = len > 0.001 ? my / Math.max(len2(mx, my), 1e-9) : p.faceY;
      this.dashTime = FLUTTER.time;
      this.dashCooldown = FLUTTER.cooldown;
      p.iframes = Math.max(p.iframes, FLUTTER.iframes);
      this.events.push({ type: 'dash', x: p.x, y: p.y });
    }
    if (this.dashTime > 0) {
      this.dashTime -= DT;
      const dashSpeed = FLUTTER.distance / FLUTTER.time;
      p.vx = this.dashX * dashSpeed;
      p.vy = this.dashY * dashSpeed;
    }
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
      if (def.contactDamage <= 0) continue;
      if (dx * dx + dy * dy <= r * r) {
        this.hurtPlayer(
          (e.damage[s] as number) *
            (this.frenzy > 0 ? FRENZY.contactDamage : 1) *
            (this.characterDef.innate === 'no_face' ? NO_FACE.contactDamage : 1),
          def.id,
        );
        return;
      }
    }
  }

  /** What last hurt the player: enemy id, 'shot' or 'slam' (reports only). */
  lastHurtBy = '';

  hurtPlayer(raw: number, source = ''): void {
    const p = this.player;
    if (p.iframes > 0) return;
    this.lastHurtBy = source;
    const dmg = Math.max(MIN_DAMAGE, raw * (1 - ARMOR_CAP), raw - this.stats.armor);
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
    this.collected[kind] = (this.collected[kind] ?? 0) + 1;
    switch (kind) {
      case PICKUP.reliquary:
        this.openReliquary();
        break;
      case PICKUP.onigiri:
        this.heal(ONIGIRI_HEAL);
        this.mended = true;
        break;
      case PICKUP.coin:
        this.coins += (value || 1) * this.stats.greed;
        break;
      case PICKUP.lantern_burst:
        this.lanternBurst();
        break;
      case PICKUP.spirit_call:
        this.spiritCall();
        break;
      case PICKUP.frenzy:
        this.frenzy = FRENZY.seconds;
        break;
      default:
        break;
    }
  }

  // ---- stone lanterns & power-ups (GAME_DESIGN §7.2) -------------------------

  /** Place a stone lantern near the player every so often. */
  private placeLanterns(): void {
    if (this.time < this.nextLantern) return;
    this.nextLantern += STONE_LANTERN.every;
    const e = this.enemies;
    let standing = 0;
    for (let i = 0; i < e.count; i++) {
      if (e.kind[e.slots[i] as number] === ENEMY_KIND.stone_lantern) standing++;
    }
    if (standing >= STONE_LANTERN.maxStanding) return;
    const a = this.propRng.range(0, Math.PI * 2);
    const d = this.propRng.range(STONE_LANTERN.minDist, STONE_LANTERN.maxDist);
    const p = this.player;
    this.spawnEnemy(ENEMY_KIND.stone_lantern, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, true);
  }

  private breakLantern(x: number, y: number): void {
    let total = 0;
    for (const w of Object.values(LANTERN_DROPS)) total += w;
    let roll = this.propRng.range(0, total);
    let drop: LanternDrop = 'coin';
    for (const [id, w] of Object.entries(LANTERN_DROPS) as [LanternDrop, number][]) {
      roll -= w;
      if (roll < 0) {
        drop = id;
        break;
      }
    }
    const value = drop === 'coin' ? this.propRng.int(COIN_POUCH[0], COIN_POUCH[1]) : 0;
    this.pickups.drop(PICKUP[drop], x, y, value);
  }

  /** Lantern Burst: clears every non-elite in view; elites and bosses are hurt. */
  private lanternBurst(): void {
    const e = this.enemies;
    const p = this.player;
    // "In view": a circle inside the spawn ring, so enemies still arriving
    // from off screen survive whatever the screen orientation.
    const r2 = BURST_RADIUS * BURST_RADIUS;
    for (let i = e.count - 1; i >= 0; i--) {
      const s = e.slots[i] as number;
      const def = ENEMIES[e.kind[s] as number];
      if (!def || def.invulnerable || def.behaviour === 'prop') continue;
      const dx = (e.x[s] as number) - p.x;
      const dy = (e.y[s] as number) - p.y;
      if (dx * dx + dy * dy > r2) continue;
      const dmg =
        def.elite || def.boss
          ? (e.maxHp[s] as number) * LANTERN_BURST.eliteMaxHpFrac
          : (e.hp[s] as number) * 4 + 1;
      this.damageEnemy(s, dmg, 0, 0, NO_WEAPON);
    }
  }

  /** Spirit Call: every ember on the map flies to the player. */
  private spiritCall(): void {
    const em = this.embers;
    for (let i = 0; i < em.count; i++) {
      const s = em.slots[i] as number;
      em.attracted[s] = 1;
      em.speed[s] = Math.max(em.speed[s] as number, 300);
    }
  }

  // ---- secrets & late innates (GAME_DESIGN §4, §9.2) --------------------------

  private findSecret(id: string): void {
    if (this.secrets.includes(id)) return;
    this.secrets.push(id);
    this.events.push({ type: 'secret', id });
  }

  private updateSecrets(): void {
    if (!this.mended && this.time >= SECRET_RULES.kagerouAt) this.findSecret('kagerou');
    if (!this.wellPlaced && this.time >= SECRET_RULES.wellAt) {
      this.wellPlaced = true;
      const a = this.propRng.range(0, Math.PI * 2);
      const p = this.player;
      const d = SECRET_RULES.wellDistance;
      this.spawnEnemy(ENEMY_KIND.sealed_well, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, true);
    }
    if (this.flood > 0) {
      this.flood = Math.max(0, this.flood - DT);
      if (this.flood === 0 && this.player.hp > 0) this.findSecret('ido');
    }
  }

  private updateInnates(): void {
    const innate = this.characterDef.innate;
    if (innate === 'no_face' && this.time >= this.nextBlink) {
      // The nearest elite loses sight of Kagerou for a moment.
      this.nextBlink += NO_FACE.blinkEvery;
      const e = this.enemies;
      const p = this.player;
      let best = -1;
      let bestD: number = NO_FACE.blinkRange;
      for (let i = 0; i < e.count; i++) {
        const s = e.slots[i] as number;
        const def = ENEMIES[e.kind[s] as number];
        if (!def?.elite) continue;
        const d = len2((e.x[s] as number) - p.x, (e.y[s] as number) - p.y);
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      if (best >= 0) e.freezeT[best] = Math.max(e.freezeT[best] as number, NO_FACE.blinkSeconds);
    }
    if (innate === 'undertow') {
      // Pickups drift in from twice the magnet range.
      const pk = this.pickups;
      const p = this.player;
      const reach = this.magnetRadius * UNDERTOW.magnetMult;
      for (let i = 0; i < pk.count; i++) {
        const s = pk.slots[i] as number;
        const dx = p.x - (pk.x[s] as number);
        const dy = p.y - (pk.y[s] as number);
        const d = len2(dx, dy);
        if (d > reach || d < 1) continue;
        const step = Math.min(d, UNDERTOW.driftSpeed * DT);
        pk.x[s] = (pk.x[s] as number) + (dx / d) * step;
        pk.y[s] = (pk.y[s] as number) + (dy / d) * step;
      }
      const at = UNDERTOW.floodAt[this.floodsDone];
      if (at !== undefined && this.time >= at) {
        this.floodsDone++;
        this.events.push({ type: 'flood' });
        const e = this.enemies;
        for (let i = e.count - 1; i >= 0; i--) {
          const s = e.slots[i] as number;
          const def = ENEMIES[e.kind[s] as number];
          if (!def || def.invulnerable || def.behaviour === 'prop') continue;
          this.damageEnemy(s, (e.maxHp[s] as number) * UNDERTOW.floodMaxHpFrac, 0, 0, NO_WEAPON);
        }
      }
    }
  }
}
