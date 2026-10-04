import { ENEMIES, MAX_ENEMY_RADIUS } from '../data/enemies';
import { WEAPONS, weaponStatsAt, type WeaponStats } from '../data/weapons';
import { DT } from './constants';
import type { Sim } from './sim';
import type { OwnedWeapon } from './upgrades';
import { len2 } from './vec';

/** Ofuda look for targets this far away. */
const TARGET_RANGE = 520;
/** Homing turn rate, radians per second. */
const HOMING_TURN = 5;
/** Recheck delay when a weapon had nothing to shoot at. */
const IDLE_RETRY = 0.1;

export function updateWeapons(sim: Sim): void {
  for (const w of sim.weapons) {
    w.cooldown -= DT;
    if (w.cooldown > 0) continue;
    const def = WEAPONS[w.weapon];
    if (!def) continue;
    const stats = weaponStatsAt(def, w.level);
    const fired = def.behaviour === 'sweep' ? fireSweep(sim, w, stats) : fireHoming(sim, w, stats);
    w.cooldown = fired ? Math.max(0.05, stats.cooldown * sim.stats.cooldown) : IDLE_RETRY;
    if (fired) w.fired++;
  }
}

/** Sector attack around the facing direction; extra swings go back, left, right. */
function fireSweep(sim: Sim, w: OwnedWeapon, stats: WeaponStats): boolean {
  const p = sim.player;
  const e = sim.enemies;
  const radius = stats.area * sim.stats.area;
  const half = stats.arc / 2;
  const damage = stats.damage * sim.stats.might;
  const swings = Math.min(4, stats.amount + sim.stats.amount);
  const face = Math.atan2(p.faceY, p.faceX);
  const offsets = [0, Math.PI, Math.PI / 2, -Math.PI / 2];
  const n = sim.enemyGrid.query(p.x, p.y, radius + MAX_ENEMY_RADIUS, sim.scratch);
  // damageEnemy may remove enemies (checked with isAlive) but never touches scratch.
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
        arc: stats.arc,
      });
    }
    for (let k = 0; k < n; k++) {
      const s = sim.scratch[k] as number;
      if (!e.isAlive(s)) continue;
      const def = ENEMIES[e.kind[s] as number];
      if (!def) continue;
      const dx = (e.x[s] as number) - p.x;
      const dy = (e.y[s] as number) - p.y;
      const d = len2(dx, dy);
      if (d > radius + def.radius) continue;
      const pointBlank = d <= def.radius + p.radius;
      // Angle between facing and the enemy, widened by the enemy's size.
      const cos = d > 0 ? (dx * cx + dy * cy) / d : 1;
      const slack = d > 0 ? Math.asin(Math.min(1, def.radius / d)) : Math.PI;
      if (!pointBlank && Math.acos(Math.max(-1, Math.min(1, cos))) > half + slack) continue;
      const ux = d > 0 ? dx / d : cx;
      const uy = d > 0 ? dy / d : cy;
      sim.damageEnemy(s, damage, ux * stats.knockback, uy * stats.knockback, w.weapon);
    }
  }
  return true;
}

function nearestEnemy(sim: Sim, range: number): number {
  const p = sim.player;
  const e = sim.enemies;
  const n = sim.enemyGrid.query(p.x, p.y, range, sim.scratch);
  let best = -1;
  let bestD2 = range * range;
  for (let k = 0; k < n; k++) {
    const s = sim.scratch[k] as number;
    if (!e.isAlive(s)) continue;
    const dx = (e.x[s] as number) - p.x;
    const dy = (e.y[s] as number) - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = s;
    }
  }
  return best;
}

function fireHoming(sim: Sim, w: OwnedWeapon, stats: WeaponStats): boolean {
  const target = nearestEnemy(sim, TARGET_RANGE);
  if (target < 0) return false;
  const p = sim.player;
  const e = sim.enemies;
  const count = stats.amount + sim.stats.amount;
  const speed = stats.speed * sim.stats.projSpeed;
  const base = Math.atan2((e.y[target] as number) - p.y, (e.x[target] as number) - p.x);
  for (let i = 0; i < count; i++) {
    const a = base + (i - (count - 1) / 2) * 0.22;
    const slot = sim.projectiles.spawn(
      w.weapon,
      p.x,
      p.y,
      Math.cos(a) * speed,
      Math.sin(a) * speed,
    );
    if (slot < 0) break;
    const pr = sim.projectiles;
    pr.radius[slot] = stats.area * sim.stats.area;
    pr.damage[slot] = stats.damage * sim.stats.might;
    pr.knockback[slot] = stats.knockback;
    pr.life[slot] = stats.duration * sim.stats.duration;
    pr.pierce[slot] = stats.pierce;
    pr.targetSlot[slot] = target;
    pr.targetId[slot] = e.id[target] as number;
  }
  if (sim.events.enabled) {
    sim.events.push({ type: 'projectile_fired', weapon: w.weapon, x: p.x, y: p.y });
  }
  return true;
}

export function updateProjectiles(sim: Sim): void {
  const pr = sim.projectiles;
  const e = sim.enemies;
  const maxTurn = HOMING_TURN * DT;
  for (let i = pr.count - 1; i >= 0; i--) {
    const s = pr.slots[i] as number;
    const life = (pr.life[s] as number) - DT;
    pr.life[s] = life;
    if (life <= 0) {
      pr.remove(s);
      continue;
    }
    let vx = pr.vx[s] as number;
    let vy = pr.vy[s] as number;
    const t = pr.targetSlot[s] as number;
    if (t >= 0 && e.isAlive(t) && e.id[t] === pr.targetId[s]) {
      const want = Math.atan2(
        (e.y[t] as number) - (pr.y[s] as number),
        (e.x[t] as number) - (pr.x[s] as number),
      );
      const have = Math.atan2(vy, vx);
      let diff = want - have;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
      const sp = len2(vx, vy);
      vx = Math.cos(have + turn) * sp;
      vy = Math.sin(have + turn) * sp;
      pr.vx[s] = vx;
      pr.vy[s] = vy;
    } else {
      pr.targetSlot[s] = -1;
    }
    const x = (pr.x[s] as number) + vx * DT;
    const y = (pr.y[s] as number) + vy * DT;
    pr.x[s] = x;
    pr.y[s] = y;

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
      const sp = len2(vx, vy) || 1;
      const kb = pr.knockback[s] as number;
      pr.recordHit(s, id);
      sim.damageEnemy(
        es,
        pr.damage[s] as number,
        (vx / sp) * kb,
        (vy / sp) * kb,
        pr.weapon[s] as number,
      );
      const left = (pr.pierce[s] as number) - 1;
      pr.pierce[s] = left;
      if (left <= 0) {
        pr.remove(s);
        break;
      }
    }
  }
}
