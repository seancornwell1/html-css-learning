import { ENEMIES, MAX_ENEMY_RADIUS } from '../data/enemies';
import { WEAPONS, weaponStatsAt, type WeaponDef, type WeaponStats } from '../data/weapons';
import { DT, MAX_ENEMIES } from './constants';
import { MODE } from './projectile-pool';
import type { Sim } from './sim';
import type { OwnedWeapon } from './upgrades';
import { len2 } from './vec';

/** "On screen" for targeting, in world units (fits both orientations). */
const SCREEN_RANGE = 430;
/** Homing turn rate, radians per second. */
const HOMING_TURN = 5;
const WANDER_TURN = 1.4;
/** Recheck delay when a weapon had nothing to shoot at. */
const IDLE_RETRY = 0.1;
/** Orbits that never expire are re-dealt this often (keeps counts in sync with Amount). */
const PERMANENT_ORBIT = 10;
const TURRET_FIRE = 0.9;
const TURRET_RANGE = 320;
const TURRET_SHOT_SPEED = 360;

const pickBuf = new Int32Array(MAX_ENEMIES);

export function updateWeapons(sim: Sim): void {
  for (const w of sim.weapons) {
    if (w.active > 0) w.active -= DT;
    w.cooldown -= DT;
    if (w.cooldown > 0) continue;
    const def = WEAPONS[w.weapon];
    if (!def) continue;
    const s = weaponStatsAt(def, w.level);
    const fired = fire(sim, def, w, s);
    if (fired === false) {
      w.cooldown = IDLE_RETRY;
      continue;
    }
    w.fired++;
    const rain = def.effects?.rain ?? 0;
    if (rain > 0) {
      const m = randomEnemies(sim, rain, SCREEN_RANGE);
      for (let i = 0; i < m; i++)
        strikeAt(sim, pickBuf[i] as number, s.damage * sim.stats.might, w.weapon);
    }
    // fire() may set its own cooldown (orbits); otherwise use the stat.
    if (w.cooldown <= 0) w.cooldown = Math.max(0.05, s.cooldown * sim.stats.cooldown);
  }
  updateTurrets(sim);
}

function fire(sim: Sim, def: WeaponDef, w: OwnedWeapon, s: WeaponStats): boolean {
  switch (def.behaviour) {
    case 'sweep':
      return fireSweep(sim, def, w, s);
    case 'whip':
      return fireWhip(sim, w, s);
    case 'homing':
      return fireHoming(sim, def, w, s);
    case 'orbit':
    case 'parasol':
      return fireOrbit(sim, def, w, s);
    case 'nova':
      return fireNova(sim, def, w, s);
    case 'aura':
      return fireAura(sim, def, w, s);
    case 'fan':
      return fireFan(sim, def, w, s);
    case 'zone_drop':
      return fireZoneDrop(sim, def, w, s);
    case 'boomerang':
      return fireBoomerang(sim, def, w, s);
    case 'strike':
      return fireStrike(sim, def, w, s);
    case 'ricochet':
      return fireRicochet(sim, w, s);
    case 'beam':
      return fireBeam(sim, def, w, s);
    case 'trail':
      return fireTrail(sim, def, w, s);
    case 'wander':
      return fireWander(sim, def, w, s);
    case 'turret':
      return fireTurret(sim, def, w, s);
  }
}

// ---- targeting helpers ------------------------------------------------------

export function nearestEnemy(sim: Sim, x: number, y: number, range: number, skipId = 0): number {
  const e = sim.enemies;
  const n = sim.enemyGrid.query(x, y, range, sim.scratch);
  let best = -1;
  let bestD2 = range * range;
  for (let k = 0; k < n; k++) {
    const s = sim.scratch[k] as number;
    if (!e.isAlive(s) || e.id[s] === skipId) continue;
    const dx = (e.x[s] as number) - x;
    const dy = (e.y[s] as number) - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = s;
    }
  }
  return best;
}

/** Up to `count` distinct random live enemies within `range`; returns how many. */
function randomEnemies(sim: Sim, count: number, range: number): number {
  const p = sim.player;
  const e = sim.enemies;
  const n = sim.enemyGrid.query(p.x, p.y, range, sim.scratch);
  let m = 0;
  for (let k = 0; k < n; k++) {
    const s = sim.scratch[k] as number;
    if (!e.isAlive(s)) continue;
    const dx = (e.x[s] as number) - p.x;
    const dy = (e.y[s] as number) - p.y;
    if (dx * dx + dy * dy <= range * range) pickBuf[m++] = s;
  }
  const take = Math.min(count, m);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(sim.combatRng.float() * (m - i));
    const t = pickBuf[i] as number;
    pickBuf[i] = pickBuf[j] as number;
    pickBuf[j] = t;
  }
  return take;
}

/** Angle with the most enemies within `range` (16 sectors). */
function densestAngle(sim: Sim, range: number): number {
  const p = sim.player;
  const e = sim.enemies;
  const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const n = sim.enemyGrid.query(p.x, p.y, range, sim.scratch);
  for (let k = 0; k < n; k++) {
    const s = sim.scratch[k] as number;
    if (!e.isAlive(s)) continue;
    const a = Math.atan2((e.y[s] as number) - p.y, (e.x[s] as number) - p.x);
    const i = ((Math.round((a / (Math.PI * 2)) * 16) % 16) + 16) % 16;
    counts[i] = (counts[i] ?? 0) + 1;
  }
  let best = 0;
  for (let i = 1; i < 16; i++) if ((counts[i] ?? 0) > (counts[best] ?? 0)) best = i;
  return (counts[best] ?? 0) === 0 ? Math.atan2(p.faceY, p.faceX) : (best / 16) * Math.PI * 2;
}

function amountOf(sim: Sim, s: WeaponStats): number {
  return Math.max(1, Math.round(s.amount + sim.stats.amount));
}

/** Hit every live enemy within `radius` of (x, y); returns hits. */
function hitCircle(
  sim: Sim,
  x: number,
  y: number,
  radius: number,
  damage: number,
  knockback: number,
  weapon: number,
  slow = 0,
): number {
  const e = sim.enemies;
  const n = sim.enemyGrid.query(x, y, radius + MAX_ENEMY_RADIUS, sim.scratch);
  let hits = 0;
  for (let k = 0; k < n; k++) {
    const s = sim.scratch[k] as number;
    if (!e.isAlive(s)) continue;
    const def = ENEMIES[e.kind[s] as number];
    if (!def) continue;
    const dx = (e.x[s] as number) - x;
    const dy = (e.y[s] as number) - y;
    const d = len2(dx, dy);
    if (d > radius + def.radius) continue;
    const ux = d > 0 ? dx / d : 1;
    const uy = d > 0 ? dy / d : 0;
    if (slow > 0) sim.applyStatus(s, slow, 0.6, 0);
    sim.damageEnemy(s, damage, ux * knockback, uy * knockback, weapon);
    hits++;
  }
  return hits;
}

// ---- behaviours ---------------------------------------------------------------

/** Sector attack around the facing direction; extra swings go back, left, right. */
function fireSweep(sim: Sim, def: WeaponDef, w: OwnedWeapon, s: WeaponStats): boolean {
  const p = sim.player;
  const e = sim.enemies;
  const radius = s.area * sim.stats.area;
  const half = s.arc / 2;
  const full = s.arc >= Math.PI * 2 - 1e-6;
  const damage = s.damage * sim.stats.might;
  const swings = full ? 1 : Math.min(4, Math.round(s.amount + sim.stats.amount));
  const face = Math.atan2(p.faceY, p.faceX);
  const offsets = [0, Math.PI, Math.PI / 2, -Math.PI / 2];
  const n = sim.enemyGrid.query(p.x, p.y, radius + MAX_ENEMY_RADIUS, sim.scratch);
  for (let sw = 0; sw < swings; sw++) {
    const angle = face + (offsets[sw] ?? 0);
    const cx = Math.cos(angle);
    const cy = Math.sin(angle);
    if (sim.events.enabled) {
      sim.events.push({
        type: 'sweep',
        weapon: w.weapon,
        x: p.x,
        y: p.y,
        angle,
        radius,
        arc: s.arc,
      });
    }
    for (let k = 0; k < n; k++) {
      const es = sim.scratch[k] as number;
      if (!e.isAlive(es)) continue;
      const ed = ENEMIES[e.kind[es] as number];
      if (!ed) continue;
      const dx = (e.x[es] as number) - p.x;
      const dy = (e.y[es] as number) - p.y;
      const d = len2(dx, dy);
      if (d > radius + ed.radius) continue;
      if (!full && d > ed.radius + p.radius) {
        // Angle between facing and the enemy, widened by the enemy's size.
        const cos = (dx * cx + dy * cy) / d;
        const slack = Math.asin(Math.min(1, ed.radius / d));
        if (Math.acos(Math.max(-1, Math.min(1, cos))) > half + slack) continue;
      }
      const ux = d > 0 ? dx / d : cx;
      const uy = d > 0 ? dy / d : cy;
      sim.damageEnemy(es, damage, ux * s.knockback, uy * s.knockback, w.weapon);
    }
  }
  const burn = def.effects?.burnZones ?? 0;
  for (let i = 0; i < burn; i++) {
    const a = sim.combatRng.range(0, Math.PI * 2);
    const r = radius * sim.combatRng.range(0.4, 0.9);
    const z = sim.zones.spawn(
      w.weapon,
      p.x + Math.cos(a) * r,
      p.y + Math.sin(a) * r,
      26 * sim.stats.area,
      damage * 0.2,
      s.tick,
      s.duration * sim.stats.duration,
    );
    if (z < 0) break;
  }
  return true;
}

/** Horizontal slashes: first toward the facing side, then the other. */
function fireWhip(sim: Sim, w: OwnedWeapon, s: WeaponStats): boolean {
  const p = sim.player;
  const e = sim.enemies;
  const length = s.area * sim.stats.area;
  const halfH = 16 * sim.stats.area;
  const damage = s.damage * sim.stats.might;
  const first = p.faceX >= 0 ? 1 : -1;
  const slashes = Math.min(2, Math.round(s.amount + sim.stats.amount));
  const n = sim.enemyGrid.query(p.x, p.y, length + MAX_ENEMY_RADIUS, sim.scratch);
  for (let k = 0; k < slashes; k++) {
    const side = k === 0 ? first : -first;
    if (sim.events.enabled) {
      sim.events.push({
        type: 'whip',
        weapon: w.weapon,
        x: p.x,
        y: p.y,
        side,
        length,
        width: halfH * 2,
      });
    }
    for (let j = 0; j < n; j++) {
      const es = sim.scratch[j] as number;
      if (!e.isAlive(es)) continue;
      const ed = ENEMIES[e.kind[es] as number];
      if (!ed) continue;
      const dx = ((e.x[es] as number) - p.x) * side;
      const dy = (e.y[es] as number) - p.y;
      if (dx < -ed.radius || dx > length + ed.radius || Math.abs(dy) > halfH + ed.radius) continue;
      sim.damageEnemy(es, damage, side * s.knockback, 0, w.weapon);
    }
  }
  return true;
}

function spawnShot(
  sim: Sim,
  w: OwnedWeapon,
  s: WeaponStats,
  mode: number,
  angle: number,
  speed: number,
  x = sim.player.x,
  y = sim.player.y,
): number {
  const pr = sim.projectiles;
  const slot = pr.spawn(w.weapon, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed);
  if (slot < 0) return -1;
  pr.mode[slot] = mode;
  pr.radius[slot] = Math.max(4, s.area * sim.stats.area);
  pr.damage[slot] = s.damage * sim.stats.might;
  pr.knockback[slot] = s.knockback;
  pr.life[slot] = s.duration * sim.stats.duration;
  pr.pierce[slot] = s.pierce;
  return slot;
}

function fireHoming(sim: Sim, def: WeaponDef, w: OwnedWeapon, s: WeaponStats): boolean {
  const p = sim.player;
  const e = sim.enemies;
  const target = nearestEnemy(sim, p.x, p.y, 520);
  if (target < 0) return false;
  const count = amountOf(sim, s);
  const speed = s.speed * sim.stats.projSpeed;
  const base = Math.atan2((e.y[target] as number) - p.y, (e.x[target] as number) - p.x);
  for (let i = 0; i < count; i++) {
    const slot = spawnShot(sim, w, s, MODE.homing, base + (i - (count - 1) / 2) * 0.22, speed);
    if (slot < 0) break;
    sim.projectiles.targetSlot[slot] = target;
    sim.projectiles.targetId[slot] = e.id[target] as number;
    sim.projectiles.freeze[slot] = def.effects?.freeze ?? 0;
  }
  if (sim.events.enabled)
    sim.events.push({ type: 'projectile_fired', weapon: w.weapon, x: p.x, y: p.y });
  return true;
}

/** Orbiting projectiles (moths; the parasol is a tight, fast single orbit). */
function fireOrbit(sim: Sim, def: WeaponDef, w: OwnedWeapon, s: WeaponStats): boolean {
  const permanent = def.effects?.permanent || def.behaviour === 'parasol';
  const life = permanent ? PERMANENT_ORBIT : s.duration * sim.stats.duration;
  // Clear any previous orbit of this weapon (re-deal keeps Amount in sync).
  const pr = sim.projectiles;
  for (let i = pr.count - 1; i >= 0; i--) {
    const slot = pr.slots[i] as number;
    if (pr.weapon[slot] === w.weapon && pr.mode[slot] === MODE.orbit) pr.remove(slot);
  }
  // Parasols scale with their own levels; Amount from passives counts half.
  const count =
    def.behaviour === 'parasol'
      ? Math.round(s.amount) + Math.floor(sim.stats.amount / 2)
      : amountOf(sim, s);
  for (let i = 0; i < count; i++) {
    const slot = spawnShot(sim, w, s, MODE.orbit, 0, 0);
    if (slot < 0) break;
    pr.radius[slot] = def.behaviour === 'parasol' ? 16 * sim.stats.area : 10 * sim.stats.area;
    pr.life[slot] = life;
    pr.pierce[slot] = Infinity;
    pr.a[slot] = (i / count) * Math.PI * 2;
    // Orbit radius and angular speed.
    pr.b[slot] = s.area * sim.stats.area;
    pr.vx[slot] = s.speed * sim.stats.projSpeed;
    pr.vy[slot] = def.effects?.permanent ? 1 : 0; // 1 = radius pulse
    pr.rehit[slot] = s.tick;
  }
  w.active = life;
  w.cooldown = permanent ? life : life + s.cooldown * sim.stats.cooldown;
  return true;
}

function fireNova(sim: Sim, def: WeaponDef, w: OwnedWeapon, s: WeaponStats): boolean {
  const p = sim.player;
  const radius = s.area * sim.stats.area;
  if (sim.events.enabled)
    sim.events.push({ type: 'nova', weapon: w.weapon, x: p.x, y: p.y, radius });
  hitCircle(sim, p.x, p.y, radius, s.damage * sim.stats.might, s.knockback, w.weapon);
  const execute = def.effects?.execute ?? 0;
  if (execute > 0) {
    const e = sim.enemies;
    const n = sim.enemyGrid.query(p.x, p.y, radius + MAX_ENEMY_RADIUS, sim.scratch);
    for (let k = 0; k < n; k++) {
      const es = sim.scratch[k] as number;
      if (!e.isAlive(es) || ENEMIES[e.kind[es] as number]?.boss) continue;
      const dx = (e.x[es] as number) - p.x;
      const dy = (e.y[es] as number) - p.y;
      if (dx * dx + dy * dy > radius * radius) continue;
      if ((e.hp[es] as number) < (e.maxHp[es] as number) * execute) {
        sim.damageEnemy(es, e.hp[es] as number, 0, 0, w.weapon);
      }
    }
  }
  return true;
}

function fireAura(sim: Sim, _def: WeaponDef, w: OwnedWeapon, s: WeaponStats): boolean {
  const p = sim.player;
  hitCircle(
    sim,
    p.x,
    p.y,
    s.area * sim.stats.area,
    s.damage * sim.stats.might,
    0,
    w.weapon,
    s.slow,
  );
  return true;
}

function fireFan(sim: Sim, def: WeaponDef, w: OwnedWeapon, s: WeaponStats): boolean {
  const p = sim.player;
  let count = amountOf(sim, s);
  if (def.effects?.speedScaling) count += Math.floor(len2(p.vx, p.vy) / 60);
  const speed = s.speed * sim.stats.projSpeed;
  const face = Math.atan2(p.faceY, p.faceX);
  for (let i = 0; i < count; i++) {
    const a = face + (i - (count - 1) / 2) * s.arc;
    if (spawnShot(sim, w, s, MODE.straight, a, speed) < 0) break;
  }
  if (sim.events.enabled)
    sim.events.push({ type: 'projectile_fired', weapon: w.weapon, x: p.x, y: p.y });
  return true;
}

function strikeAt(sim: Sim, slot: number, damage: number, weapon: number): void {
  const e = sim.enemies;
  if (!e.isAlive(slot)) return;
  const x = e.x[slot] as number;
  const y = e.y[slot] as number;
  if (sim.events.enabled) sim.events.push({ type: 'strike', weapon, x, y });
  sim.damageEnemy(slot, damage, 0, 0, weapon);
}

function fireZoneDrop(sim: Sim, def: WeaponDef, w: OwnedWeapon, s: WeaponStats): boolean {
  const count = amountOf(sim, s);
  const m = randomEnemies(sim, count, SCREEN_RANGE);
  if (m === 0) return false;
  for (let i = 0; i < count; i++) {
    const t = pickBuf[i % m] as number;
    const jitter = i >= m ? 30 : 0;
    const z = sim.zones.spawn(
      w.weapon,
      (sim.enemies.x[t] as number) + sim.combatRng.range(-jitter, jitter),
      (sim.enemies.y[t] as number) + sim.combatRng.range(-jitter, jitter),
      s.area * sim.stats.area,
      s.damage * sim.stats.might,
      s.tick,
      s.duration * sim.stats.duration,
    );
    if (z < 0) break;
    sim.zones.chase[z] = def.effects?.chase ?? 0;
    sim.zones.slow[z] = s.slow;
  }
  return true;
}

function fireBoomerang(sim: Sim, def: WeaponDef, w: OwnedWeapon, s: WeaponStats): boolean {
  const p = sim.player;
  const count = amountOf(sim, s);
  const speed = s.speed * sim.stats.projSpeed;
  const spiral = def.effects?.spiral === true;
  let base = Math.atan2(p.faceY, p.faceX);
  if (!spiral) {
    const t = nearestEnemy(sim, p.x, p.y, 420);
    if (t >= 0) {
      base = Math.atan2((sim.enemies.y[t] as number) - p.y, (sim.enemies.x[t] as number) - p.x);
    }
  }
  for (let i = 0; i < count; i++) {
    const a = spiral ? base + (i / count) * Math.PI * 2 : base + (i - (count - 1) / 2) * 0.35;
    const slot = spawnShot(sim, w, s, MODE.boomerang, a, speed);
    if (slot < 0) break;
    const pr = sim.projectiles;
    pr.b[slot] = a; // launch angle
    pr.a[slot] = spiral ? 2.2 : 0; // turn rate (spiral)
    pr.vx[slot] = speed; // launch speed
    pr.vy[slot] = 0;
    pr.life[slot] = s.duration * sim.stats.duration * 1.6;
    pr.rehit[slot] = (s.duration * sim.stats.duration) / 2;
  }
  return true;
}

function fireStrike(sim: Sim, def: WeaponDef, w: OwnedWeapon, s: WeaponStats): boolean {
  const count = amountOf(sim, s);
  const m = randomEnemies(sim, count, SCREEN_RANGE);
  if (m === 0) return false;
  const damage = s.damage * sim.stats.might;
  const chain = def.effects?.chain ?? 0;
  for (let i = 0; i < m; i++) {
    let slot = pickBuf[i] as number;
    let x = sim.enemies.x[slot] as number;
    let y = sim.enemies.y[slot] as number;
    let lastId = sim.enemies.id[slot] as number;
    strikeAt(sim, slot, damage, w.weapon);
    // Radius of the strike splash.
    hitCircle(sim, x, y, s.area * sim.stats.area, damage * 0.5, 0, w.weapon);
    for (let c = 0; c < chain; c++) {
      slot = nearestEnemy(sim, x, y, 170, lastId);
      if (slot < 0) break;
      const nx = sim.enemies.x[slot] as number;
      const ny = sim.enemies.y[slot] as number;
      if (sim.events.enabled) sim.events.push({ type: 'chain', x1: x, y1: y, x2: nx, y2: ny });
      lastId = sim.enemies.id[slot] as number;
      sim.damageEnemy(slot, damage * 0.7, 0, 0, w.weapon);
      x = nx;
      y = ny;
    }
  }
  return true;
}

function fireRicochet(sim: Sim, w: OwnedWeapon, s: WeaponStats): boolean {
  const p = sim.player;
  const e = sim.enemies;
  const count = amountOf(sim, s);
  const target = nearestEnemy(sim, p.x, p.y, 480);
  if (target < 0) return false;
  const base = Math.atan2((e.y[target] as number) - p.y, (e.x[target] as number) - p.x);
  const speed = s.speed * sim.stats.projSpeed;
  for (let i = 0; i < count; i++) {
    const slot = spawnShot(sim, w, s, MODE.ricochet, base + (i - (count - 1) / 2) * 0.3, speed);
    if (slot < 0) break;
    sim.projectiles.targetSlot[slot] = target;
    sim.projectiles.targetId[slot] = e.id[target] as number;
  }
  return true;
}

function fireBeam(sim: Sim, def: WeaponDef, w: OwnedWeapon, s: WeaponStats): boolean {
  const p = sim.player;
  const e = sim.enemies;
  const length = s.area * sim.stats.area;
  const half = 9 * sim.stats.area;
  const damage = s.damage * sim.stats.might;
  const count = amountOf(sim, s);
  const base = densestAngle(sim, length);
  const n = sim.enemyGrid.query(p.x, p.y, length + MAX_ENEMY_RADIUS, sim.scratch);
  // Copy candidates: damage may trigger kills but never re-queries the grid here.
  let m = 0;
  for (let k = 0; k < n; k++) pickBuf[m++] = sim.scratch[k] as number;
  for (let b = 0; b < count; b++) {
    const angle = base + (b - (count - 1) / 2) * s.arc;
    const cx = Math.cos(angle);
    const cy = Math.sin(angle);
    if (sim.events.enabled) {
      sim.events.push({
        type: 'beam',
        weapon: w.weapon,
        x: p.x,
        y: p.y,
        angle,
        length,
        width: half * 2,
      });
    }
    for (let k = 0; k < m; k++) {
      const es = pickBuf[k] as number;
      if (!e.isAlive(es)) continue;
      const ed = ENEMIES[e.kind[es] as number];
      if (!ed) continue;
      const dx = (e.x[es] as number) - p.x;
      const dy = (e.y[es] as number) - p.y;
      const along = dx * cx + dy * cy;
      if (along < 0 || along > length + ed.radius) continue;
      const across = Math.abs(dx * cy - dy * cx);
      if (across > half + ed.radius) continue;
      sim.damageEnemy(
        es,
        damage,
        cx * s.knockback,
        cy * s.knockback,
        w.weapon,
        def.effects?.xpBonus ?? 0,
      );
    }
  }
  return true;
}

function fireTrail(sim: Sim, _def: WeaponDef, w: OwnedWeapon, s: WeaponStats): boolean {
  const p = sim.player;
  const z = sim.zones.spawn(
    w.weapon,
    p.x,
    p.y,
    s.area * sim.stats.area,
    s.damage * sim.stats.might,
    s.tick,
    s.duration * sim.stats.duration,
  );
  if (z >= 0) sim.zones.slow[z] = s.slow;
  return true;
}

function fireWander(sim: Sim, def: WeaponDef, w: OwnedWeapon, s: WeaponStats): boolean {
  const p = sim.player;
  const speed = s.speed * sim.stats.projSpeed;
  if (def.effects?.dragon) {
    // Dragon: one great fish crosses the screen through the player's position.
    const a = sim.combatRng.range(0, Math.PI * 2);
    const sx = p.x - Math.cos(a) * 600;
    const sy = p.y - Math.sin(a) * 600;
    const slot = spawnShot(sim, w, s, MODE.straight, a, speed, sx, sy);
    if (slot >= 0) sim.projectiles.life[slot] = 1200 / speed;
    // Its school still swims.
  }
  const count = amountOf(sim, s);
  for (let i = 0; i < count; i++) {
    const a = sim.combatRng.range(0, Math.PI * 2);
    const slot = spawnShot(sim, w, s, MODE.wander, a, speed);
    if (slot < 0) break;
    sim.projectiles.a[slot] = sim.combatRng.range(0, 100);
    if (def.effects?.dragon) sim.projectiles.radius[slot] = 10 * sim.stats.area;
  }
  return true;
}

function fireTurret(sim: Sim, def: WeaponDef, w: OwnedWeapon, s: WeaponStats): boolean {
  const p = sim.player;
  const max = amountOf(sim, s);
  const permanent = def.effects?.revive === true;
  // Keep at most `max` turrets of this weapon: drop the oldest.
  const mine = sim.turrets.filter((t) => t.weapon === w.weapon);
  while (mine.length >= max) {
    const oldest = mine.shift();
    if (!oldest) break;
    sim.turrets.splice(sim.turrets.indexOf(oldest), 1);
  }
  sim.turrets.push({
    weapon: w.weapon,
    x: p.x,
    y: p.y,
    life: permanent ? Infinity : s.duration * sim.stats.duration,
    cooldown: 0.2,
    damage: s.damage * sim.stats.might,
    pierce: s.pierce,
  });
  if (permanent && sim.turrets.filter((t) => t.weapon === w.weapon).length >= max) {
    // Permanent lanterns stay; re-place only when one is missing.
    w.cooldown = Math.max(s.cooldown * sim.stats.cooldown, 4);
  }
  return true;
}

function updateTurrets(sim: Sim): void {
  for (let i = sim.turrets.length - 1; i >= 0; i--) {
    const t = sim.turrets[i];
    if (!t) continue;
    t.life -= DT;
    if (t.life <= 0) {
      sim.turrets.splice(i, 1);
      continue;
    }
    t.cooldown -= DT;
    if (t.cooldown > 0) continue;
    const target = nearestEnemy(sim, t.x, t.y, TURRET_RANGE);
    if (target < 0) {
      t.cooldown = IDLE_RETRY;
      continue;
    }
    t.cooldown = TURRET_FIRE * sim.stats.cooldown;
    const e = sim.enemies;
    const a = Math.atan2((e.y[target] as number) - t.y, (e.x[target] as number) - t.x);
    const pr = sim.projectiles;
    const speed = TURRET_SHOT_SPEED * sim.stats.projSpeed;
    const slot = pr.spawn(t.weapon, t.x, t.y, Math.cos(a) * speed, Math.sin(a) * speed);
    if (slot < 0) continue;
    pr.mode[slot] = MODE.turret;
    pr.radius[slot] = 7;
    pr.damage[slot] = t.damage;
    pr.knockback[slot] = 40;
    pr.life[slot] = 1.2;
    pr.pierce[slot] = t.pierce;
    pr.targetSlot[slot] = target;
    pr.targetId[slot] = e.id[target] as number;
  }
}

// ---- projectile movement and hits ---------------------------------------------

function steer(vx: number, vy: number, want: number, maxTurn: number): [number, number] {
  const have = Math.atan2(vy, vx);
  let diff = want - have;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
  const sp = len2(vx, vy);
  return [Math.cos(have + turn) * sp, Math.sin(have + turn) * sp];
}

export function updateProjectiles(sim: Sim): void {
  const pr = sim.projectiles;
  const e = sim.enemies;
  const p = sim.player;
  for (let i = pr.count - 1; i >= 0; i--) {
    const s = pr.slots[i] as number;
    const life = (pr.life[s] as number) - DT;
    pr.life[s] = life;
    if (life <= 0) {
      pr.remove(s);
      continue;
    }
    const age = (pr.age[s] as number) + DT;
    pr.age[s] = age;
    const mode = pr.mode[s] as number;
    let x = pr.x[s] as number;
    let y = pr.y[s] as number;
    let vx = pr.vx[s] as number;
    let vy = pr.vy[s] as number;

    if (mode === MODE.orbit) {
      const pulse = vy === 1 ? 1 + 0.25 * Math.sin(age * 2.2) : 1;
      const r = (pr.b[s] as number) * pulse;
      const ang = (pr.a[s] as number) + age * vx;
      x = p.x + Math.cos(ang) * r;
      y = p.y + Math.sin(ang) * r;
      const rh = (pr.rehitT[s] as number) - DT;
      if (rh <= 0) {
        pr.clearHits(s);
        pr.rehitT[s] = pr.rehit[s] as number;
      } else {
        pr.rehitT[s] = rh;
      }
    } else if (mode === MODE.boomerang) {
      // Out and back along a (possibly curving) line.
      const total = (pr.rehit[s] as number) * 2;
      const sp = (pr.vx[s] as number) * (1 - age / Math.max(total / 2, 0.01));
      const ang = (pr.b[s] as number) + age * (pr.a[s] as number);
      x += Math.cos(ang) * sp * DT;
      y += Math.sin(ang) * sp * DT;
      if (age - DT < total / 2 && age >= total / 2) pr.clearHits(s);
    } else {
      const t = pr.targetSlot[s] as number;
      const tracking =
        (mode === MODE.homing || mode === MODE.ricochet || mode === MODE.turret) &&
        t >= 0 &&
        e.isAlive(t) &&
        e.id[t] === pr.targetId[s];
      if (tracking) {
        const want = Math.atan2((e.y[t] as number) - y, (e.x[t] as number) - x);
        [vx, vy] = steer(vx, vy, want, (mode === MODE.ricochet ? 9 : HOMING_TURN) * DT);
      } else if (mode === MODE.wander) {
        const near = nearestEnemy(sim, x, y, 260);
        const wobble = Math.sin(age * 3 + (pr.a[s] as number)) * 0.9;
        const want =
          near >= 0
            ? Math.atan2((e.y[near] as number) - y, (e.x[near] as number) - x) + wobble * 0.4
            : Math.atan2(vy, vx) + wobble * DT * 2;
        [vx, vy] = steer(vx, vy, want, WANDER_TURN * DT);
      } else if (t >= 0) {
        pr.targetSlot[s] = -1;
      }
      pr.vx[s] = vx;
      pr.vy[s] = vy;
      x += vx * DT;
      y += vy * DT;
    }
    pr.x[s] = x;
    pr.y[s] = y;

    collide(sim, s, x, y);
  }
}

function collide(sim: Sim, s: number, x: number, y: number): void {
  const pr = sim.projectiles;
  const e = sim.enemies;
  const r = pr.radius[s] as number;
  const n = sim.enemyGrid.query(x, y, r + MAX_ENEMY_RADIUS, sim.scratch);
  for (let k = 0; k < n; k++) {
    const es = sim.scratch[k] as number;
    if (!e.isAlive(es)) continue;
    const id = e.id[es] as number;
    if (pr.hasHit(s, id)) continue;
    const def = ENEMIES[e.kind[es] as number];
    if (!def) continue;
    const dx = (e.x[es] as number) - x;
    const dy = (e.y[es] as number) - y;
    const rr = r + def.radius;
    if (dx * dx + dy * dy > rr * rr) continue;
    const mode = pr.mode[s] as number;
    let kx: number;
    let ky: number;
    if (mode === MODE.orbit) {
      // Orbits push enemies outward from the player.
      const ox = (e.x[es] as number) - sim.player.x;
      const oy = (e.y[es] as number) - sim.player.y;
      const ol = len2(ox, oy) || 1;
      kx = ox / ol;
      ky = oy / ol;
    } else {
      const sp = len2(pr.vx[s] as number, pr.vy[s] as number) || 1;
      kx = (pr.vx[s] as number) / sp;
      ky = (pr.vy[s] as number) / sp;
    }
    const kb = pr.knockback[s] as number;
    pr.recordHit(s, id);
    const weapon = pr.weapon[s] as number;
    const freeze = pr.freeze[s] as number;
    if (freeze > 0) sim.applyStatus(es, 0, 0, freeze);
    const hx = e.x[es] as number;
    const hy = e.y[es] as number;
    sim.damageEnemy(es, pr.damage[s] as number, kx * kb, ky * kb, weapon);
    if (mode === MODE.ricochet) {
      const pull = WEAPONS[weapon]?.effects?.pull ?? 0;
      if (pull > 0) pullToward(sim, hx, hy, pull);
      // Bounce to the nearest enemy not hit yet.
      const next = nearestUnhit(sim, s, hx, hy, 220);
      if (next >= 0) {
        pr.targetSlot[s] = next;
        pr.targetId[s] = e.id[next] as number;
        const sp = len2(pr.vx[s] as number, pr.vy[s] as number);
        const a = Math.atan2((e.y[next] as number) - hy, (e.x[next] as number) - hx);
        pr.vx[s] = Math.cos(a) * sp;
        pr.vy[s] = Math.sin(a) * sp;
      }
    }
    const left = (pr.pierce[s] as number) - 1;
    pr.pierce[s] = left;
    if (left <= 0) {
      pr.remove(s);
      return;
    }
  }
}

function nearestUnhit(sim: Sim, proj: number, x: number, y: number, range: number): number {
  const e = sim.enemies;
  const n = sim.enemyGrid.query(x, y, range, pickBuf);
  let best = -1;
  let bestD2 = range * range;
  for (let k = 0; k < n; k++) {
    const s = pickBuf[k] as number;
    if (!e.isAlive(s) || sim.projectiles.hasHit(proj, e.id[s] as number)) continue;
    const dx = (e.x[s] as number) - x;
    const dy = (e.y[s] as number) - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = s;
    }
  }
  return best;
}

function pullToward(sim: Sim, x: number, y: number, strength: number): void {
  const e = sim.enemies;
  const n = sim.enemyGrid.query(x, y, 90, pickBuf);
  for (let k = 0; k < n; k++) {
    const s = pickBuf[k] as number;
    if (!e.isAlive(s)) continue;
    const dx = x - (e.x[s] as number);
    const dy = y - (e.y[s] as number);
    const d = len2(dx, dy) || 1;
    const k2 = ENEMIES[e.kind[s] as number]?.knockback ?? 1;
    e.kbx[s] = (e.kbx[s] as number) + (dx / d) * strength * k2;
    e.kby[s] = (e.kby[s] as number) + (dy / d) * strength * k2;
  }
}

// ---- zones ------------------------------------------------------------------

export function updateZones(sim: Sim): void {
  const z = sim.zones;
  for (let i = z.count - 1; i >= 0; i--) {
    const s = z.slots[i] as number;
    const life = (z.life[s] as number) - DT;
    z.life[s] = life;
    if (life <= 0) {
      z.remove(s);
      continue;
    }
    const chase = z.chase[s] as number;
    if (chase > 0) {
      const t = nearestEnemy(sim, z.x[s] as number, z.y[s] as number, 320);
      if (t >= 0) {
        const dx = (sim.enemies.x[t] as number) - (z.x[s] as number);
        const dy = (sim.enemies.y[t] as number) - (z.y[s] as number);
        const d = len2(dx, dy);
        if (d > 1) {
          z.x[s] = (z.x[s] as number) + (dx / d) * Math.min(d, chase * DT);
          z.y[s] = (z.y[s] as number) + (dy / d) * Math.min(d, chase * DT);
        }
      }
    }
    const timer = (z.timer[s] as number) - DT;
    if (timer > 0) {
      z.timer[s] = timer;
      continue;
    }
    z.timer[s] = timer + (z.tick[s] as number);
    hitCircle(
      sim,
      z.x[s] as number,
      z.y[s] as number,
      z.radius[s] as number,
      z.damage[s] as number,
      0,
      z.weapon[s] as number,
      z.slow[s] as number,
    );
  }
}
