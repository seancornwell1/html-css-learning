import { WEAPONS, weaponStatsAt } from '../data/weapons';
import type { SimEvent } from '../sim/events';
import { PICKUP } from '../sim/pickup-pool';
import type { Sim } from '../sim/sim';
import { PALETTE, withAlpha } from './palette';
import type { Sprite, SpriteCache } from './sprites';

/**
 * Presentation of weapons beyond sprites: sweeps, slashes, shockwaves,
 * beams, lightning, ground zones, auras, turrets and pickups. Reads sim
 * state/events only.
 */
type Fx =
  | {
      kind: 'sweep';
      x: number;
      y: number;
      angle: number;
      radius: number;
      arc: number;
      age: number;
      life: number;
    }
  | {
      kind: 'whip';
      x: number;
      y: number;
      side: number;
      length: number;
      width: number;
      age: number;
      life: number;
    }
  | { kind: 'ring'; x: number; y: number; radius: number; age: number; life: number }
  | {
      kind: 'beam';
      x: number;
      y: number;
      angle: number;
      length: number;
      width: number;
      age: number;
      life: number;
    }
  | {
      kind: 'bolt';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      seed: number;
      age: number;
      life: number;
    };

const MAX_FX = 96;

/** Projectile look per weapon id (rotated sprites, or 'prop:' unrotated). */
export const PROJECTILE_LOOK: Record<string, string> = {
  ofuda_volley: 'ofuda',
  thousand_seals: 'ofuda',
  kunai_fan: 'kunai',
  ravens_rain: 'kunai',
  harvest_moon: 'crescent',
  spirit_moths: 'prop:moth',
  moth_lords_veil: 'prop:moth',
  lantern_festival: 'prop:moth',
  paper_crane: 'crane',
  senbazuru: 'crane',
  bone_chimes: 'chime',
  ossuary_wind: 'chime',
  koi_spirits: 'koi',
  dragon_gate: 'koi',
  stone_watchfire: 'shot',
  keeper_of_the_dead: 'shot',
  oil_paper_parasol: 'prop:parasol',
  hundred_year_parasol: 'prop:parasol',
};

/** Zone look per weapon id. */
const ZONE_LOOK: Record<string, string> = {
  fox_fire: 'flame',
  nine_tailed_inferno: 'flame',
  sunfall_censer: 'flame',
  lantern_festival: 'flame',
  incense_burner: 'smoke',
  hungry_ghost_feast: 'smoke',
};

const PICKUP_PROP: Record<number, string> = {
  [PICKUP.reliquary]: 'reliquary',
  [PICKUP.onigiri]: 'onigiri',
  [PICKUP.coin]: 'coin',
};

export class WeaponFx {
  private readonly items: Fx[] = [];
  private time = 0;

  reset(): void {
    this.items.length = 0;
  }

  onEvent(e: SimEvent): void {
    if (this.items.length >= MAX_FX) return;
    switch (e.type) {
      case 'sweep':
        this.items.push({
          kind: 'sweep',
          ...pick(e, ['x', 'y', 'angle', 'radius', 'arc']),
          age: 0,
          life: 0.18,
        });
        break;
      case 'whip':
        this.items.push({
          kind: 'whip',
          ...pick(e, ['x', 'y', 'side', 'length', 'width']),
          age: 0,
          life: 0.16,
        });
        break;
      case 'nova':
      case 'slam':
        this.items.push({ kind: 'ring', x: e.x, y: e.y, radius: e.radius, age: 0, life: 0.35 });
        break;
      case 'beam':
        this.items.push({
          kind: 'beam',
          ...pick(e, ['x', 'y', 'angle', 'length', 'width']),
          age: 0,
          life: 0.2,
        });
        break;
      case 'strike':
        this.items.push({
          kind: 'bolt',
          x1: e.x + 30,
          y1: e.y - 420,
          x2: e.x,
          y2: e.y,
          seed: (e.x * 13 + e.y * 7) | 0,
          age: 0,
          life: 0.18,
        });
        break;
      case 'chain':
        this.items.push({
          kind: 'bolt',
          ...pick(e, ['x1', 'y1', 'x2', 'y2']),
          seed: (e.x1 * 3 + e.y2) | 0,
          age: 0,
          life: 0.15,
        });
        break;
      default:
        break;
    }
  }

  /** Ground layer: zones, aura rings, turrets, pickups. World transform must be set. */
  drawGround(
    ctx: CanvasRenderingContext2D,
    sim: Sim,
    sprites: SpriteCache,
    blit: Blit,
    dt: number,
  ): void {
    this.time += dt;
    // Auras (salt circle family): a dotted ring and faint fill.
    for (const w of sim.weapons) {
      const def = WEAPONS[w.weapon];
      if (def?.behaviour !== 'aura') continue;
      const r = weaponStatsAt(def, w.level).area * sim.stats.area;
      ctx.fillStyle = withAlpha(PALETTE.ash, 0.18);
      ctx.beginPath();
      ctx.arc(sim.player.x, sim.player.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = withAlpha(PALETTE.bone, 0.55);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 6]);
      ctx.lineDashOffset = -this.time * 20;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Zones.
    const z = sim.zones;
    for (let i = 0; i < z.count; i++) {
      const s = z.slots[i] as number;
      const look = ZONE_LOOK[WEAPONS[z.weapon[s] as number]?.id ?? ''] ?? 'flame';
      const x = z.x[s] as number;
      const y = z.y[s] as number;
      const r = z.radius[s] as number;
      const fade = Math.min(1, (z.life[s] as number) / 0.4);
      if (look === 'smoke') {
        ctx.globalAlpha = 0.35 * fade;
        blit(sprites.props.get('smoke')?.[0], x, y, r / 14);
      } else {
        ctx.globalAlpha = fade;
        const frames = sprites.props.get('flame');
        const f = Math.floor(this.time * 10 + s) % 3;
        blit(frames?.[f], x, y, r / 22);
      }
      ctx.globalAlpha = 1;
    }
    // Turrets.
    for (const t of sim.turrets) blit(sprites.props.get('stone_lantern')?.[0], t.x, t.y, 1);
    // Pickups, gently bobbing.
    const pk = sim.pickups;
    for (let i = 0; i < pk.count; i++) {
      const s = pk.slots[i] as number;
      const prop = PICKUP_PROP[pk.kind[s] as number] ?? 'reliquary';
      const bob = Math.sin(this.time * 3 + s) * 2;
      blit(sprites.props.get(prop)?.[0], pk.x[s] as number, (pk.y[s] as number) + bob, 1);
    }
  }

  /** Transient effects above the actors. World transform must be set. */
  drawEffects(ctx: CanvasRenderingContext2D, dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const f = this.items[i] as Fx;
      f.age += dt;
      if (f.age >= f.life) {
        this.items.splice(i, 1);
        continue;
      }
      const t = f.age / f.life;
      switch (f.kind) {
        case 'sweep': {
          // The lantern's arc of light: a crescent that sweeps across, then fades.
          const full = f.arc >= Math.PI * 2 - 1e-6;
          const start = full ? f.angle + t * Math.PI : f.angle - f.arc / 2;
          const head = start + f.arc * Math.min(1, t * 1.8);
          const tail = start + f.arc * Math.max(0, t * 1.8 - 0.8);
          ctx.fillStyle = withAlpha(PALETTE.gold, 0.9 * (1 - t));
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.radius, tail, head);
          ctx.arc(f.x, f.y, f.radius * 0.62, head, tail, true);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = withAlpha(PALETTE.bone, 1 - t);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.radius, tail, head);
          ctx.stroke();
          break;
        }
        case 'whip': {
          // A thin chain-slash that thins out.
          const h = f.width * (1 - t) * 0.5;
          const x0 = f.x;
          const x1 = f.x + f.side * f.length * Math.min(1, t * 3);
          ctx.fillStyle = withAlpha(PALETTE.bone, 1 - t);
          ctx.beginPath();
          ctx.moveTo(x0, f.y - 2);
          ctx.quadraticCurveTo((x0 + x1) / 2, f.y - h - 4, x1, f.y);
          ctx.quadraticCurveTo((x0 + x1) / 2, f.y + h * 0.3, x0, f.y + 2);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'ring': {
          ctx.strokeStyle = withAlpha(PALETTE.bone, 1 - t);
          ctx.lineWidth = 6 * (1 - t) + 1;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.radius * (0.3 + 0.7 * Math.sqrt(t)), 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'beam': {
          const c = Math.cos(f.angle);
          const sn = Math.sin(f.angle);
          const w = f.width * (1 - t);
          ctx.strokeStyle = withAlpha(PALETTE.bone, 1 - t * 0.5);
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(f.x, f.y);
          ctx.lineTo(f.x + c * f.length, f.y + sn * f.length);
          ctx.stroke();
          ctx.strokeStyle = withAlpha(PALETTE.gold, 1 - t);
          ctx.lineWidth = Math.max(1, w * 0.3);
          ctx.stroke();
          break;
        }
        case 'bolt': {
          ctx.strokeStyle = withAlpha(PALETTE.bone, 1 - t);
          ctx.lineWidth = 2.5 * (1 - t) + 0.5;
          ctx.beginPath();
          ctx.moveTo(f.x1, f.y1);
          const segs = 6;
          let seed = f.seed;
          for (let k = 1; k < segs; k++) {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            const jitter = ((seed % 1000) / 1000 - 0.5) * 26;
            const u = k / segs;
            ctx.lineTo(f.x1 + (f.x2 - f.x1) * u + jitter, f.y1 + (f.y2 - f.y1) * u + jitter * 0.4);
          }
          ctx.lineTo(f.x2, f.y2);
          ctx.stroke();
          break;
        }
      }
    }
  }
}

/** Draw a sprite centred at a world position, optionally scaled. */
export type Blit = (sprite: Sprite | undefined, x: number, y: number, scale: number) => void;

function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) out[k] = obj[k];
  return out;
}
