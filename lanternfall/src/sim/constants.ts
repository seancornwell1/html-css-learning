export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
/** Dawn: surviving this long wins the run (GAME_DESIGN §3.1). */
export const RUN_SECONDS = 600;

/** Fixed visible world area (GAME_DESIGN §8.4); rotated in portrait. */
export const VIEW_LONG = 1100;
export const VIEW_SHORT = 620;
/**
 * Enemies spawn on a ring just outside the view's corners, so they never
 * pop in on screen, whatever the aspect ratio.
 */
export const SPAWN_RADIUS = Math.hypot(VIEW_LONG, VIEW_SHORT) / 2 + 40;
/** Enemies further than this from the player are recycled closer. */
export const DESPAWN_RADIUS = SPAWN_RADIUS * 1.25;

export const MAX_ENEMIES = 500;
export const MAX_PROJECTILES = 1024;
export const MAX_EMBERS = 400;
