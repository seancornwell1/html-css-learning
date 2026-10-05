/**
 * The only colours in the game (GAME_DESIGN §7.3). Gold is reserved for the
 * player's light, XP embers, evolutions, Frenzy and focused UI.
 */
export const PALETTE = {
  ink: '#07070A',
  ink2: '#121218',
  ash: '#6E6E78',
  bone: '#F2F0EA',
  gold: '#F5B83D',
} as const;

/**
 * Print tones (GAME_DESIGN §7.3.1): illustration and UI ornament only
 * (portraits, seals, cartouches, bokashi skies). Never gameplay entities.
 */
export const PRINT = {
  /** Deep indigo (ai): skies, pattern grounds, portrait backdrops. */
  ai: '#1C2A4A',
  aiDeep: '#0E1528',
  /** Vermilion (shu): seals, cartouche borders, illustrated blood. */
  shu: '#C8322A',
  /** Aged washi, for paper panels. */
  washi: '#E9E1CF',
} as const;

/** `#RRGGBB` + alpha → `rgba(...)`, for glows and fades of palette colours. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
