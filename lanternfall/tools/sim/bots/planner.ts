import { ENEMIES } from '../../../src/data/enemies';
import { STATE } from '../../../src/sim/enemy-ai';
import type { Intent } from '../../../src/sim/intent';
import type { Sim } from '../../../src/sim/sim';
import type { Bot } from './bot';
import { hazardRisk, isProp, meleeReach, predictEnemy, priorityChoice } from './sense';

/** Reaction: re-plans every 3 ticks (50 ms), like the skilled bot. */
const THINK_EVERY = 3;
const HEADINGS = 16;
/** Lookahead sample times, seconds. */
const HORIZON = [0.2, 0.45, 0.8, 1.2] as const;
const SENSE = 420;

export interface PlannerParams {
  /** Weight of predicted contact (a near-certain hit). */
  contact: number;
  /** Weight of crowd pressure near each sample point. */
  crowd: number;
  /** Comfort distance from ordinary enemies, px. */
  comfort: number;
  /** Weight of XP and pickups reachable along the path. */
  loot: number;
  /** Weight of a predicted shot hit, relative to contact. */
  shot: number;
  /** Weight of enemies inside weapon reach (offence: kills feed XP). */
  engage: number;
  /** Weight of open escape directions at the path's end (anti-boxing). */
  space: number;
  /** Preference for keeping the previous heading (smoothness). */
  inertia: number;
  /** Most weapons to carry while planning evolutions. */
  focusWeapons: number;
}

export const DEFAULT_PLANNER: PlannerParams = {
  contact: 60,
  crowd: 1.2,
  comfort: 45,
  shot: 1.5,
  engage: 1.2,
  loot: 2.5,
  space: 3,
  inertia: 0.6,
  focusWeapons: 4,
};

/** Defaults, overridable as JSON in PLANNER_PARAMS (for searches). */
export function plannerParams(): PlannerParams {
  const raw = typeof process !== 'undefined' ? process.env.PLANNER_PARAMS : undefined;
  if (!raw) return DEFAULT_PLANNER;
  return { ...DEFAULT_PLANNER, ...(JSON.parse(raw) as Partial<PlannerParams>) };
}

/**
 * Planner (M10 skilled bot candidate): instead of a potential field, it
 * scores a fan of headings by rolling the player forward over a 1.2 s
 * lookahead against predicted enemy, shot and hazard positions, and picks
 * the best trade between danger, crowding, loot on the way and room to
 * escape afterwards. Same 50 ms reaction as the skilled bot; reads the sim
 * only (CLAUDE.md rule 3).
 */
export class PlannerBot implements Bot {
  readonly name = 'planner';
  private mx = 0;
  private my = 0;
  private dash = false;
  private readonly near = new Int32Array(512);
  private readonly dirX = new Float64Array(HEADINGS + 1);
  private readonly dirY = new Float64Array(HEADINGS + 1);

  constructor(
    _seed: number,
    private readonly p: PlannerParams = plannerParams(),
  ) {
    for (let i = 0; i < HEADINGS; i++) {
      const a = (i / HEADINGS) * Math.PI * 2;
      this.dirX[i] = Math.cos(a);
      this.dirY[i] = Math.sin(a);
    }
    // Last candidate: stand still.
    this.dirX[HEADINGS] = 0;
    this.dirY[HEADINGS] = 0;
  }

  decide(sim: Sim, out: Intent): Intent {
    if (sim.tick % THINK_EVERY === 0) this.think(sim);
    out.moveX = this.mx;
    out.moveY = this.my;
    out.action = this.dash;
    return out;
  }

  choose(sim: Sim): number {
    return priorityChoice(sim, sim.choices ?? [], true, this.p.focusWeapons);
  }

  private think(sim: Sim): void {
    const pl = sim.player;
    const n = sim.enemyGrid.query(pl.x, pl.y, SENSE, this.near);
    let best = -Infinity;
    let bestI = HEADINGS;
    let bestDanger = 0;
    for (let i = 0; i <= HEADINGS; i++) {
      const dx = this.dirX[i] as number;
      const dy = this.dirY[i] as number;
      const [score, danger] = this.score(sim, n, dx, dy);
      const keep = (dx * this.mx + dy * this.my) * this.p.inertia;
      if (score + keep > best) {
        best = score + keep;
        bestI = i;
        bestDanger = danger;
      }
    }
    this.mx = this.dirX[bestI] as number;
    this.my = this.dirY[bestI] as number;
    // Hotaru: dash through when even the best line still makes contact soon.
    this.dash = bestDanger >= this.p.contact && sim.dashCooldown <= 0;
  }

  /** [score, contact danger] for running along (dx, dy). */
  private score(sim: Sim, n: number, dx: number, dy: number): [number, number] {
    const P = this.p;
    const pl = sim.player;
    const e = sim.enemies;
    const speed = sim.moveSpeed;
    let danger = 0;
    let crowd = 0;
    let engage = 0;
    const melee = meleeReach(sim);
    const reach = melee || 190;
    // Melee fighters must let enemies close to hit them.
    const comfort = melee ? Math.min(P.comfort, melee * 0.5) : P.comfort;
    for (let h = 0; h < HORIZON.length; h++) {
      const t = HORIZON[h] as number;
      const urgency = 1 / (1 + h);
      const px = pl.x + dx * speed * t;
      const py = pl.y + dy * speed * t;
      for (let k = 0; k < n; k++) {
        const s = this.near[k] as number;
        if (!e.isAlive(s) || isProp(e.kind[s] as number)) continue;
        const def = ENEMIES[e.kind[s] as number];
        if (!def) continue;
        const q = predictEnemy(sim, s, t, px, py);
        const ox = px - q.x;
        const oy = py - q.y;
        const d = Math.sqrt(ox * ox + oy * oy) - def.radius - pl.radius;
        const heavy = def.elite || def.boss || def.behaviour === 'lunge' ? 2 : 1;
        if (d < 4) danger += P.contact * urgency * heavy * (e.damage[s] as number) * 0.1;
        else if (d < comfort) crowd += ((comfort - d) / comfort) * urgency * heavy;
        else if (h === 1 && d < reach) engage += 1;
      }
      danger += hazardRisk(sim, px, py, t) * P.contact * 0.3 * urgency;
    }
    // Telegraphed lunges and charges are fast too: sweep them finely.
    for (let k = 0; k < n; k++) {
      const s = this.near[k] as number;
      if (!e.isAlive(s)) continue;
      const b = ENEMIES[e.kind[s] as number];
      if (!b || (b.behaviour !== 'lunge' && b.behaviour !== 'mother')) continue;
      const st = e.state[s] as number;
      if (st !== STATE.windup && st !== STATE.act) continue;
      const r = b.radius + pl.radius + 6;
      for (let step = 1; step <= 20; step++) {
        const t = step * 0.05;
        const px = pl.x + dx * speed * t;
        const py = pl.y + dy * speed * t;
        const q = predictEnemy(sim, s, t, px, py);
        const ox = px - q.x;
        const oy = py - q.y;
        if (ox * ox + oy * oy < r * r) {
          danger += P.contact * P.shot * 1.5 * (1.1 - t);
          break;
        }
      }
    }
    // Shots are fast: sweep the path finely and count any crossing as a hit.
    const sh = sim.enemyShots;
    for (let i = 0; i < sh.count; i++) {
      const k = sh.slots[i] as number;
      if (sh.reflected[k]) continue;
      const r = (sh.radius[k] as number) + pl.radius + 3;
      for (let step = 1; step <= 10; step++) {
        const t = step * 0.1;
        const px = pl.x + dx * speed * t;
        const py = pl.y + dy * speed * t;
        const ox = px - ((sh.x[k] as number) + (sh.vx[k] as number) * t);
        const oy = py - ((sh.y[k] as number) + (sh.vy[k] as number) * t);
        if (ox * ox + oy * oy < r * r) {
          danger += P.contact * P.shot * (1.2 - t);
          break;
        }
      }
    }
    // Room to escape at the end of the path: free directions among 8.
    const t = HORIZON[HORIZON.length - 1] as number;
    const ex = pl.x + dx * speed * t;
    const ey = pl.y + dy * speed * t;
    let free = 0;
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2;
      const fx = ex + Math.cos(a) * 90;
      const fy = ey + Math.sin(a) * 90;
      let blocked = false;
      for (let k = 0; k < n && !blocked; k++) {
        const s = this.near[k] as number;
        if (!e.isAlive(s) || isProp(e.kind[s] as number)) continue;
        const ox = fx - (e.x[s] as number);
        const oy = fy - (e.y[s] as number);
        if (ox * ox + oy * oy < 45 * 45) blocked = true;
      }
      if (!blocked) free++;
    }
    // Loot gathered along the path (embers inside the magnet, pickups).
    let loot = 0;
    const mag = sim.magnetRadius;
    const em = sim.embers;
    for (let i = 0; i < em.count; i++) {
      const s = em.slots[i] as number;
      const ox = (em.x[s] as number) - ex;
      const oy = (em.y[s] as number) - ey;
      const d2 = ox * ox + oy * oy;
      if (d2 < mag * mag * 4) loot += (em.value[s] as number) / (1 + Math.sqrt(d2) / mag);
    }
    const pk = sim.pickups;
    for (let i = 0; i < pk.count; i++) {
      const s = pk.slots[i] as number;
      const ox = (pk.x[s] as number) - ex;
      const oy = (pk.y[s] as number) - ey;
      loot += 25 / (1 + Math.sqrt(ox * ox + oy * oy) / 60);
    }
    const score =
      -danger -
      crowd * P.crowd +
      Math.log1p(engage) * P.engage +
      Math.log1p(loot) * P.loot +
      (free / 8) * P.space * 3;
    return [score, danger];
  }
}
