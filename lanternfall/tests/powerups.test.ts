import { describe, expect, it } from 'vitest';
import { ENEMIES, ENEMY_KIND } from '../src/data/enemies';
import { FRENZY, STONE_LANTERN } from '../src/data/powerups';
import { TICK_RATE } from '../src/sim/constants';
import { PICKUP } from '../src/sim/pickup-pool';
import { Sim } from '../src/sim/sim';

const still = { moveX: 0, moveY: 0, action: false };

/** A sim with no director spawns and no weapons, for isolated checks. */
function bare(seed = 1): Sim {
  const sim = new Sim({ seed, events: false });
  sim.weapons.length = 0;
  return sim;
}

function clearEnemies(sim: Sim): void {
  for (let i = sim.enemies.count - 1; i >= 0; i--) {
    sim.enemies.remove(sim.enemies.slots[i] as number);
  }
}

function lanterns(sim: Sim): number[] {
  const out: number[] = [];
  for (let i = 0; i < sim.enemies.count; i++) {
    const s = sim.enemies.slots[i] as number;
    if (sim.enemies.kind[s] === ENEMY_KIND.stone_lantern) out.push(s);
  }
  return out;
}

describe('stone lanterns', () => {
  it('appear near the player on schedule and stand still', () => {
    const sim = bare();
    // Keep the field empty so nothing else interferes (or kills the player).
    for (let i = 0; i < (STONE_LANTERN.first + 0.1) * TICK_RATE; i++) {
      for (let k = sim.enemies.count - 1; k >= 0; k--) {
        const e = sim.enemies.slots[k] as number;
        if (sim.enemies.kind[e] !== ENEMY_KIND.stone_lantern) sim.enemies.remove(e);
      }
      sim.step(still);
      if (sim.choices) sim.choose(0);
    }
    expect(sim.status).toBe('running');
    const found = lanterns(sim);
    expect(found.length).toBe(1);
    const s = found[0] as number;
    const x = sim.enemies.x[s] as number;
    const d = Math.hypot(x - sim.player.x, (sim.enemies.y[s] as number) - sim.player.y);
    expect(d).toBeGreaterThanOrEqual(STONE_LANTERN.minDist - 1);
    expect(d).toBeLessThanOrEqual(STONE_LANTERN.maxDist + 1);
    sim.step(still);
    expect(sim.enemies.x[s]).toBe(x);
  });

  it('drop a pickup when broken, never count as kills, never hurt', () => {
    const sim = bare();
    clearEnemies(sim);
    const slot = sim.spawnEnemy(ENEMY_KIND.stone_lantern, 0, 0, true);
    const hp = sim.player.hp;
    for (let i = 0; i < 30; i++) sim.step(still);
    expect(sim.player.hp).toBe(hp);
    sim.damageEnemy(slot, 1e6, 0, 0, 0);
    expect(sim.kills).toBe(0);
    expect(sim.pickups.count).toBe(1);
  });
});

describe('power-ups', () => {
  it('Lantern Burst clears non-elites in view and wounds elites', () => {
    const sim = bare();
    clearEnemies(sim);
    const walker = sim.spawnEnemy(ENEMY_KIND.faceless_walker, 200, 0, true);
    const far = sim.spawnEnemy(ENEMY_KIND.faceless_walker, 2000, 0, true);
    const bride = sim.spawnEnemy(ENEMY_KIND.bride_of_the_reservoir, -200, 0, true);
    const brideHp = sim.enemies.maxHp[bride] as number;
    sim.pickups.drop(PICKUP.lantern_burst, sim.player.x, sim.player.y);
    sim.step(still);
    expect(sim.enemies.isAlive(walker)).toBe(false);
    expect(sim.enemies.isAlive(far)).toBe(true);
    expect(sim.enemies.isAlive(bride)).toBe(true);
    expect(sim.enemies.hp[bride] as number).toBeLessThan(brideHp * 0.75);
  });

  it('Spirit Call pulls every ember on the map', () => {
    const sim = bare();
    clearEnemies(sim);
    sim.embers.drop(1500, 0, 1, 0, 0);
    sim.embers.drop(-900, 700, 1, 0, 0);
    sim.pickups.drop(PICKUP.spirit_call, sim.player.x, sim.player.y);
    for (let i = 0; i < 4 * TICK_RATE; i++) sim.step(still);
    expect(sim.embers.count).toBe(0);
  });

  it('Frenzy speeds the player and halves contact damage for its duration', () => {
    const sim = bare();
    clearEnemies(sim);
    const base = sim.moveSpeed;
    sim.pickups.drop(PICKUP.frenzy, sim.player.x, sim.player.y);
    sim.step(still);
    expect(sim.frenzy).toBeGreaterThan(0);
    expect(sim.moveSpeed).toBeCloseTo(base * FRENZY.moveSpeed);
    const hp = sim.player.hp;
    const s = sim.spawnEnemy(ENEMY_KIND.faceless_walker, sim.player.x, sim.player.y, true);
    const raw = sim.enemies.damage[s] as number;
    sim.step(still);
    expect(hp - sim.player.hp).toBeCloseTo(Math.max(1, raw * FRENZY.contactDamage), 0);
    for (let i = 0; i < FRENZY.seconds * TICK_RATE; i++) sim.step(still);
    expect(sim.frenzy).toBe(0);
  });

  it('elites always drop coins, and coins add to the run total', () => {
    const sim = bare();
    clearEnemies(sim);
    const slot = sim.spawnEnemy(ENEMY_KIND.bride_of_the_reservoir, 0, 0, true);
    expect(ENEMIES[ENEMY_KIND.bride_of_the_reservoir]?.elite).toBe(true);
    sim.damageEnemy(slot, 1e9, 0, 0, 0);
    for (let i = 0; i < 60; i++) {
      sim.step(still);
      if (sim.choices) sim.choose(0);
    }
    expect(sim.coins).toBeGreaterThan(0);
  });
});
