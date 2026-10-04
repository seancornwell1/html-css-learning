/** XP needed to go from `level` to `level + 1` (GAME_DESIGN §3.1). */
export function xpToNext(level: number): number {
  let need = level <= 20 ? 5 + 10 * (level - 1) : 5 + 10 * 19 + 13 * (level - 20);
  if (level >= 40) need *= 1.5;
  return need;
}

/** Upgrade cards offered per level-up. */
export const CHOICES_PER_LEVEL = 3;

/** Fallback card when nothing is left to upgrade. */
export const FALLBACK_HEAL = 25;
