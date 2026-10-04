import { CHOICES_PER_LEVEL, FALLBACK_HEAL } from '../data/progression';
import { MAX_WEAPON_LEVEL, WEAPON_SLOTS, WEAPONS } from '../data/weapons';
import type { Rng } from './rng';

export type UpgradeOption =
  | { type: 'weapon_new'; weapon: number }
  | { type: 'weapon_level'; weapon: number; toLevel: number }
  | { type: 'heal'; amount: number };

export interface OwnedWeapon {
  weapon: number;
  level: number;
  /** Seconds until it next fires. */
  cooldown: number;
  /** Activations so far (sweep alternation etc.). */
  fired: number;
}

/** Every option currently legal, in a stable order. */
export function legalOptions(owned: readonly OwnedWeapon[]): UpgradeOption[] {
  const out: UpgradeOption[] = [];
  for (const w of owned) {
    if (w.level < MAX_WEAPON_LEVEL) {
      out.push({ type: 'weapon_level', weapon: w.weapon, toLevel: w.level + 1 });
    }
  }
  if (owned.length < WEAPON_SLOTS) {
    for (let i = 0; i < WEAPONS.length; i++) {
      if (!owned.some((w) => w.weapon === i)) out.push({ type: 'weapon_new', weapon: i });
    }
  }
  return out;
}

/** Draw up to CHOICES_PER_LEVEL distinct options (heal if nothing is left). */
export function rollChoices(owned: readonly OwnedWeapon[], rng: Rng): UpgradeOption[] {
  const pool = legalOptions(owned);
  if (pool.length === 0) return [{ type: 'heal', amount: FALLBACK_HEAL }];
  const picks: UpgradeOption[] = [];
  while (picks.length < CHOICES_PER_LEVEL && pool.length > 0) {
    const i = Math.floor(rng.float() * pool.length);
    picks.push(pool[i] as UpgradeOption);
    pool.splice(i, 1);
  }
  return picks;
}

export function optionLabel(o: UpgradeOption): string {
  switch (o.type) {
    case 'weapon_new':
      return WEAPONS[o.weapon]?.name ?? '?';
    case 'weapon_level':
      return `${WEAPONS[o.weapon]?.name ?? '?'} Lv ${o.toLevel}`;
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
    case 'heal':
      return 'Nothing left to learn tonight. Mend instead.';
  }
}
