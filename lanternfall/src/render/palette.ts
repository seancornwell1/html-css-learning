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

/** `#RRGGBB` + alpha → `rgba(...)`, for glows and fades of palette colours. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
