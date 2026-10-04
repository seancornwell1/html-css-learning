import { ENEMIES } from '../../../src/data/enemies';
import type { Intent } from '../../../src/sim/intent';
import { Rng } from '../../../src/sim/rng';
import type { Sim } from '../../../src/sim/sim';
import { len2 } from '../../../src/sim/vec';
import type { Bot } from './bot';
import {
  hazardRisk,
  meleeReach,
  nearestEmber,
  nearestPickup,
  predictEnemy,
  priorityChoice,
  shotRisk,
} from './sense';
import { skilledParams, type SkilledParams } from './skilled-params';

const DIRECTIONS = 24;
const HORIZONS = [0.15, 0.35, 0.6, 0.9] as const;
const SENSE_RADIUS = 320;

/**
 * Skilled (GAME_DESIGN §10): kite-and-loot instinct plus what separates a
 * skilled player: fast reactions, weapon-aware spacing, respect for heavy
 * threats (a lookahead vetoes headings into telegraphed lunges, charges,
 * slams, shots, crow lines and elite/boss bodies), reliquary hunting,
 * dashing (Hotaru) and focused, evolution-aware picks. The numbers are the
 * best policy found by `search-skilled.ts` (see skilled-params.ts).
 */
export class SkilledBot implements Bot {
  readonly name = 'skilled';
  private readonly p: SkilledParams = skilledParams();
  private readonly rng: Rng;
  private mx = 0;
  private my = 0;
  private dash = false;
  private strafeSign = 1;
  private readonly dirX = new Float64Array(DIRECTIONS);
  private readonly dirY = new Float64Array(DIRECTIONS);
  private readonly near = new Int32Array(512);

  constructor(seed: number) {
    this.rng = new Rng(seed ^ 0x5c111);
    for (let i = 0; i < DIRECTIONS; i++) {
      const a = (i / DIRECTIONS) * Math.PI * 2;
      this.dirX[i] = Math.cos(a);
      this.dirY[i] = Math.sin(a);
    }
  }

  decide(sim: Sim, out: Intent): Intent {
    if (sim.tick % this.p.thinkEvery === 0) this.think(sim);
    out.moveX = this.mx;
    out.moveY = this.my;
    out.action = this.dash;
    return out;
  }

  private think(sim: Sim): void {
    const P = this.p;
    const p = sim.player;
    const e = sim.enemies;
    const n = sim.enemyGrid.query(p.x, p.y, SENSE_RADIUS, this.near);
    const reach = meleeReach(sim);
    const normalFear =
      reach > 0 && P.meleeSpacing > 0 ? Math.max(50, reach * P.meleeSpacing) : P.fearNormal;
    const safe = normalFear * P.safeFactor;

    // 1. Instinct: kite away from close threats (heavy ones from further).
    let fx = 0;
    let fy = 0;
    let closest = Infinity;
    let heavyNear = false;
    for (let k = 0; k < n; k++) {
      const s = this.near[k] as number;
      if (!e.isAlive(s)) continue;
      const def = ENEMIES[e.kind[s] as number];
      const heavy = isHeavy(def);
      const ax = p.x - (e.x[s] as number);
      const ay = p.y - (e.y[s] as number);
      const len = len2(ax, ay) || 1;
      const d = len - (def?.radius ?? 10);
      closest = Math.min(closest, d);
      const fear = heavy ? P.heavyFear : normalFear;
      if (d >= fear) continue;
      if (heavy) heavyNear = true;
      const w = (1 - Math.max(d, 1) / fear) ** 2 * (heavy ? P.heavyWeight : 1);
      fx += (ax / len) * w;
      fy += (ay / len) * w;
    }
    const sh = sim.enemyShots;
    for (let i = 0; i < sh.count && P.shotFear > 0; i++) {
      const k = sh.slots[i] as number;
      if (sh.reflected[k]) continue;
      const dx = p.x - (sh.x[k] as number);
      const dy = p.y - (sh.y[k] as number);
      const d = len2(dx, dy) || 1;
      if (d > P.fearNormal) continue;
      const w = (1 - d / P.fearNormal) ** 2 * P.shotFear;
      fx += (dx / d) * w;
      fy += (dy / d) * w;
    }
    // Circle-strafe so facing-based weapons sweep the crowd (not near heavies).
    if (P.strafe > 0 && reach > 0 && !heavyNear && len2(fx, fy) > 0.02) {
      const a = ((P.strafe * Math.PI) / 180) * this.strafeSign;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const rx = fx * c - fy * sn;
      fy = fx * sn + fy * c;
      fx = rx;
    }

    // 2. Loot: reliquaries at any range, embers when safe.
    const chest = P.chestPull > 0 ? nearestPickup(sim, 1e6) : -1;
    if (chest >= 0 && closest > safe * P.chestMinFrac) {
      const dx = (sim.pickups.x[chest] as number) - p.x;
      const dy = (sim.pickups.y[chest] as number) - p.y;
      const d = len2(dx, dy) || 1;
      fx = fx * 0.5 + (dx / d) * P.chestPull;
      fy = fy * 0.5 + (dy / d) * P.chestPull;
    } else if (closest > safe) {
      const em = nearestEmber(sim, 450);
      if (em >= 0) {
        const dx = (sim.embers.x[em] as number) - p.x;
        const dy = (sim.embers.y[em] as number) - p.y;
        const d = len2(dx, dy) || 1;
        fx += (dx / d) * P.emberPull;
        fy += (dy / d) * P.emberPull;
      }
    }
    if (P.jitter > 0) {
      fx += this.rng.range(-P.jitter, P.jitter);
      fy += this.rng.range(-P.jitter, P.jitter);
    }
    const fl = len2(fx, fy);
    let wantX = fl > 0.05 ? fx / fl : 0;
    let wantY = fl > 0.05 ? fy / fl : 0;

    // 3. Veto: avoid predicted contact with heavy threats; closest safe heading.
    this.dash = false;
    if (P.veto > 0 && this.risk(sim, n, wantX, wantY) > 0) {
      let best = Infinity;
      let bestRisk = Infinity;
      this.strafeSign = -this.strafeSign;
      for (let i = 0; i < DIRECTIONS; i++) {
        const dx = this.dirX[i] as number;
        const dy = this.dirY[i] as number;
        const r = this.risk(sim, n, dx, dy);
        const cost =
          r * 1000 + (1 - (dx * wantX + dy * wantY)) * 10 - (dx * this.mx + dy * this.my);
        if (cost < best) {
          best = cost;
          bestRisk = r;
          wantX = dx;
          wantY = dy;
        }
      }
      if (bestRisk > 0 && sim.dashCooldown <= 0) this.dash = true;
    }
    this.mx = wantX;
    this.my = wantY;
  }

  /** Predicted-contact risk along heading (dx, dy) over the lookahead. */
  private risk(sim: Sim, n: number, dx: number, dy: number): number {
    const p = sim.player;
    const e = sim.enemies;
    const speed = sim.moveSpeed;
    let risk = 0;
    for (let h = 0; h < HORIZONS.length; h++) {
      const t = HORIZONS[h] as number;
      const px = p.x + dx * speed * t;
      const py = p.y + dy * speed * t;
      for (let k = 0; k < n; k++) {
        const s = this.near[k] as number;
        if (!e.isAlive(s)) continue;
        const def = ENEMIES[e.kind[s] as number];
        if (!def || (!this.p.vetoNormal && !isHeavy(def))) continue;
        const q = predictEnemy(sim, s, t, px, py);
        const contact = def.radius + p.radius + 4;
        const ox = px - q.x;
        const oy = py - q.y;
        if (ox * ox + oy * oy < contact * contact) risk += HORIZONS.length - h;
      }
      risk += hazardRisk(sim, px, py, t) + shotRisk(sim, px, py, t);
    }
    return risk;
  }

  choose(sim: Sim): number {
    return priorityChoice(sim, sim.choices ?? [], true, this.p.focusWeapons);
  }
}

/** Threats a skilled player never trades a hit with. */
function isHeavy(def: (typeof ENEMIES)[number] | undefined): boolean {
  if (!def) return false;
  return (
    def.behaviour === 'lunge' ||
    def.behaviour === 'flank' ||
    def.elite === true ||
    def.boss === true
  );
}
