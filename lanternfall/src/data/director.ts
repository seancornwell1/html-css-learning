/** Spawn-director tunables (GAME_DESIGN §6.2). */
export const DIRECTOR = {
  /** Chance a pack spawns in the half-circle ahead of the player's movement. */
  spawnAheadChance: 0.65,
  maxSpawnsPerTick: 24,
  /** Encirclement rings close in from this radius (visible, so they read). */
  encircleRadius: 420,
} as const;
