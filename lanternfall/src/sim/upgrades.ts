import { CHOICES_PER_LEVEL, FALLBACK_HEAL } from '../data/progression';
import { PASSIVES, PASSIVE_SLOTS, passiveMaxLevel } from '../data/passives';
import { WEAPONS, WEAPON_SLOTS, maxLevel, weaponIndex, type WeaponDef } from '../data/weapons';
import type { Rng } from './rng';

export type UpgradeOption =
  | { type: 'weapon_new'; weapon: number }
  | { type: 'weapon_level'; weapon: number; toLevel: number }
  | { type: 'passive_new'; passive: number }
  | { type: 'passive_level'; passive: number; toLevel: number }
  | { type: 'heal'; amount: number };

export interface OwnedWeapon {
  weapon: number;
  level: number;
  /** Seconds until it next fires. */
  cooldown: number;
  /** Activations so far (sweep alternation etc.). */
  fired: number;
  /** Hits landed (lifesteal counters). */
  hits: number;
  /** Seconds the current orbit has left (orbit weapons). */
  active: number;
}

export interface OwnedPassive {
  passive: number;
  level: number;
}

export interface Loadout {
  readonly weapons: readonly OwnedWeapon[];
  readonly passives: readonly OwnedPassive[];
  /** Weapon ids that must never be offered as new (e.g. evolved into). */
  readonly retired: ReadonlySet<number>;
}

/** Weapons that can be found on level-up: base weapons only. */
function offerable(def: WeaponDef): boolean {
  return !def.evolvedFrom && !def.unionOf;
}

/** Every option currently legal, in a stable order. */
export function legalOptions(l: Loadout): UpgradeOption[] {
  const out: UpgradeOption[] = [];
  for (const w of l.weapons) {
    const def = WEAPONS[w.weapon];
    if (def && w.level < maxLevel(def)) {
      out.push({ type: 'weapon_level', weapon: w.weapon, toLevel: w.level + 1 });
    }
  }
  for (const p of l.passives) {
    const def = PASSIVES[p.passive];
    if (def && p.level < passiveMaxLevel(def)) {
      out.push({ type: 'passive_level', passive: p.passive, toLevel: p.level + 1 });
    }
  }
  if (l.weapons.length < WEAPON_SLOTS) {
    WEAPONS.forEach((def, i) => {
      if (offerable(def) && !l.retired.has(i) && !l.weapons.some((w) => w.weapon === i)) {
        out.push({ type: 'weapon_new', weapon: i });
      }
    });
  }
  if (l.passives.length < PASSIVE_SLOTS) {
    PASSIVES.forEach((_, i) => {
      if (!l.passives.some((p) => p.passive === i)) out.push({ type: 'passive_new', passive: i });
    });
  }
  return out;
}

/**
 * Draw distinct options: 3 cards, a 4th with probability (luck − 1).
 * Falls back to a heal card when nothing is left.
 */
export function rollChoices(l: Loadout, rng: Rng, luck = 1): UpgradeOption[] {
  const pool = legalOptions(l);
  if (pool.length === 0) return [{ type: 'heal', amount: FALLBACK_HEAL }];
  const count = CHOICES_PER_LEVEL + (rng.chance(Math.max(0, luck - 1)) ? 1 : 0);
  const picks: UpgradeOption[] = [];
  while (picks.length < count && pool.length > 0) {
    const i = Math.floor(rng.float() * pool.length);
    picks.push(pool[i] as UpgradeOption);
    pool.splice(i, 1);
  }
  return picks;
}

/** Owned base weapon index whose evolution is ready (Lv 8 + maxed passive), or -1. */
export function evolutionReady(l: Loadout): number {
  for (let i = 0; i < l.weapons.length; i++) {
    const w = l.weapons[i] as OwnedWeapon;
    const def = WEAPONS[w.weapon];
    if (!def?.evolvePassive || !def.evolvesInto || w.level < maxLevel(def)) continue;
    const pIndex = PASSIVES.findIndex((p) => p.id === def.evolvePassive);
    const owned = l.passives.find((p) => p.passive === pIndex);
    const pDef = PASSIVES[pIndex];
    if (owned && pDef && owned.level >= passiveMaxLevel(pDef)) return i;
  }
  return -1;
}

/** Union weapon index whose two evolved ingredients are owned, or -1. */
export function unionReady(l: Loadout, character: string): number {
  for (let u = 0; u < WEAPONS.length; u++) {
    const def = WEAPONS[u] as WeaponDef;
    if (!def.unionOf) continue;
    if (def.unionCharacter && def.unionCharacter !== character) continue;
    const [a, b] = def.unionOf;
    const ia = weaponIndex(a);
    const ib = weaponIndex(b);
    if (l.weapons.some((w) => w.weapon === ia) && l.weapons.some((w) => w.weapon === ib)) return u;
  }
  return -1;
}

export function optionLabel(o: UpgradeOption): string {
  switch (o.type) {
    case 'weapon_new':
      return WEAPONS[o.weapon]?.name ?? '?';
    case 'weapon_level':
      return `${WEAPONS[o.weapon]?.name ?? '?'} Lv ${o.toLevel}`;
    case 'passive_new':
      return PASSIVES[o.passive]?.name ?? '?';
    case 'passive_level':
      return `${PASSIVES[o.passive]?.name ?? '?'} Lv ${o.toLevel}`;
    case 'heal':
      return `Lantern Oil (+${o.amount} HP)`;
  }
}

export function optionDescription(o: UpgradeOption): string {
  switch (o.type) {
    case 'weapon_new':
      return WEAPONS[o.weapon]?.description ?? '';
    case 'weapon_level':
      return WEAPONS[o.weapon]?.levels[o.toLevel - 2]?.text ?? '';
    case 'passive_new':
    case 'passive_level':
      return PASSIVES[o.passive]?.text ?? '';
    case 'heal':
      return 'Nothing left to learn tonight. Mend instead.';
  }
}
