import { describe, expect, it } from 'vitest';
import { CHARACTERS, LANTERNLIGHT } from '../src/data/characters';
import { BEHAVIOUR, ENEMIES, ENEMY_KIND } from '../src/data/enemies';
import { WEAPONS, weaponIndex } from '../src/data/weapons';
import { RUN_SECONDS, TICK_RATE } from '../src/sim/constants';
import { STATE } from '../src/sim/enemy-ai';
import { HAZARD } from '../src/sim/hazard-pool';
import { IDLE_INTENT, type Intent } from '../src/sim/intent';
import { Sim } from '../src/sim/sim';

function steps(sim: Sim, n: number, intent: Intent = IDLE_INTENT): void {
  for (let i = 0; i < n && sim.status === 'running'; i++) {
    if (sim.choices) sim.choose(0);
    sim.step(intent);
  }
}

/** A sim with no starting weapon (pure enemy behaviour tests). */
function bare(seed = 1, character = 'akari'): Sim {
  const sim = new Sim({ seed, events: false, character });
  sim.weapons.length = 0;
  return sim;
}

describe('characters', () => {
  it('each starts with its own weapon and stat mods', () => {
    for (const c of CHARACTERS) {
      const sim = new Sim({ seed: 1, character: c.id, events: false });
      expect(WEAPONS[sim.weapons[0]?.weapon ?? -1]?.id).toBe(c.startWeapon);
    }
    const tetsu = new Sim({ seed: 1, character: 'tetsu', events: false });
    expect(tetsu.stats.maxHp).toBe(140);
    expect(tetsu.stats.armor).toBe(1);
    expect(tetsu.player.hp).toBe(140);
  });

  it("Hotaru's dash moves fast, grants i-frames, then cools down", () => {
    const sim = bare(1, 'hotaru');
    sim.step({ moveX: 1, moveY: 0, action: true });
    expect(sim.player.iframes).toBeGreaterThan(0);
    steps(sim, 9, { moveX: 1, moveY: 0, action: false });
    expect(sim.player.x).toBeGreaterThan(100);
    const x = sim.player.x;
    sim.step({ moveX: 1, moveY: 0, action: true });
    // On cooldown: normal speed only.
    expect(sim.player.x - x).toBeLessThan(5);
  });

  it('Lanternlight boosts damage inside the light only', () => {
    const sim = bare(1, 'akari');
    const near = sim.spawnEnemy(ENEMY_KIND.faceless_walker, 50, 0);
    const far = sim.spawnEnemy(ENEMY_KIND.faceless_walker, 400, 0);
    const before = [sim.enemies.hp[near] as number, sim.enemies.hp[far] as number];
    sim.damageEnemy(near, 5, 0, 0, 0);
    sim.damageEnemy(far, 5, 0, 0, 0);
    expect(before[0]! - (sim.enemies.hp[near] as number)).toBeCloseTo(5 * LANTERNLIGHT.damage);
    expect(before[1]! - (sim.enemies.hp[far] as number)).toBeCloseTo(5);
  });
});

describe('enemy behaviours', () => {
  it('Long-Neck winds up, then lunges along a locked line', () => {
    const sim = bare();
    const s = sim.spawnEnemy(ENEMY_KIND.long_neck, 150, 0);
    steps(sim, 2);
    expect(sim.enemies.state[s]).toBe(STATE.windup);
    steps(sim, Math.ceil(BEHAVIOUR.lunge.windup * TICK_RATE) + 2);
    expect(sim.enemies.state[s]).toBe(STATE.act);
  });

  it('Lantern Mouth spits an orb that can hurt the player', () => {
    const sim = bare();
    sim.spawnEnemy(ENEMY_KIND.lantern_mouth, 260, 0);
    steps(sim, Math.ceil((BEHAVIOUR.ranged.every + BEHAVIOUR.ranged.windup + 0.2) * TICK_RATE));
    expect(sim.enemyShots.count).toBeGreaterThan(0);
    steps(sim, 4 * TICK_RATE);
    expect(sim.player.hp).toBeLessThan(sim.stats.maxHp);
  });

  it('the parasol blocks a good share of enemy shots', () => {
    const shots = 16;
    const hits = (withParasol: boolean): number => {
      const sim = bare();
      if (withParasol) sim.grant([{ id: 'oil_paper_parasol', level: 8 }]);
      steps(sim, 30);
      let taken = 0;
      for (let i = 0; i < shots; i++) {
        const a = (i / shots) * Math.PI * 2;
        sim.spawnEnemyShot(Math.cos(a) * 200, Math.sin(a) * 200, a + Math.PI, 130, 7, 10, 6);
        const hp = sim.player.hp;
        for (let t = 0; t < 2 * TICK_RATE; t++) {
          // Only shots may hurt here: clear the director's spawns.
          while (sim.enemies.count > 0) sim.enemies.remove(sim.enemies.slots[0] as number);
          steps(sim, 1);
        }
        if (sim.player.hp < hp) taken++;
        sim.player.hp = sim.stats.maxHp;
      }
      return taken;
    };
    expect(hits(false)).toBe(shots);
    expect(hits(true)).toBeLessThanOrEqual(shots * 0.6);
  });

  it('Drowned leave slowing puddles', () => {
    const sim = bare();
    sim.spawnEnemy(ENEMY_KIND.drowned, 200, 0);
    steps(sim, Math.ceil(BEHAVIOUR.puddle.every * TICK_RATE) + 2);
    const kinds = Array.from(sim.hazards.slots.subarray(0, sim.hazards.count)).map(
      (k) => sim.hazards.kind[k],
    );
    expect(kinds).toContain(HAZARD.puddle);
  });

  it('the Bone Colossus telegraphs a slam that hurts if you stay inside', () => {
    const sim = bare();
    sim.spawnEnemy(ENEMY_KIND.bone_colossus, 120, 0);
    steps(sim, Math.ceil((BEHAVIOUR.colossus.every + BEHAVIOUR.colossus.windup + 0.2) * TICK_RATE));
    expect(sim.player.hp).toBeLessThan(sim.stats.maxHp);
  });

  it('crows fly straight across and leave', () => {
    const sim = bare();
    const s = sim.spawnEnemy(ENEMY_KIND.carrion_crow, -600, 0);
    sim.enemies.dirX[s] = 0;
    sim.enemies.dirY[s] = 1;
    steps(sim, 60);
    expect(sim.enemies.x[s]).toBeCloseTo(-600, 0);
  });

  it('bosses keep their listed HP regardless of the minute', () => {
    const sim = bare();
    sim.tick = 9 * 60 * TICK_RATE;
    const s = sim.spawnEnemy(ENEMY_KIND.mother_of_lanterns, 500, 0);
    expect(sim.enemies.hp[s]).toBe(ENEMIES[ENEMY_KIND.mother_of_lanterns]?.hp);
  });
});

describe('death', () => {
  it('regeneration cannot undo a lethal hit in the same tick', () => {
    const sim = bare();
    sim.grant([{ id: 'pure_water', level: 5 }]);
    sim.player.hp = 1;
    sim.spawnEnemy(ENEMY_KIND.faceless_walker, 0, 0);
    steps(sim, 2);
    expect(sim.status).toBe('dead');
  });
});

describe('the end of the night', () => {
  it('slaying the Mother of Lanterns ends the night early', () => {
    const sim = bare();
    const s = sim.spawnEnemy(ENEMY_KIND.mother_of_lanterns, 500, 0);
    sim.damageEnemy(s, 1e9, 0, 0, 0);
    sim.step(IDLE_INTENT);
    expect(sim.status).toBe('won');
    expect(sim.motherSlain).toBe(true);
  });

  it('the Long Night continues after Dawn and the Lantern-Eater cannot be hurt', () => {
    const sim = bare();
    sim.tick = RUN_SECONDS * TICK_RATE - 1;
    sim.step(IDLE_INTENT);
    expect(sim.status).toBe('won');
    sim.continueLongNight();
    expect(sim.status).toBe('running');
    sim.tick = (RUN_SECONDS + 31) * TICK_RATE;
    sim.step(IDLE_INTENT);
    const e = sim.enemies;
    const reaper = Array.from(e.slots.subarray(0, e.count)).find(
      (s) => e.kind[s] === ENEMY_KIND.lantern_eater,
    );
    expect(reaper).toBeDefined();
    sim.damageEnemy(reaper as number, 1e9, 0, 0, weaponIndex('lantern_flail'));
    expect(e.isAlive(reaper as number)).toBe(true);
  });
});
