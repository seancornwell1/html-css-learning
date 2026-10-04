export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
/** Dawn: surviving this long wins the run (GAME_DESIGN §3.1). */
export const RUN_SECONDS = 600;

/** Fixed visible world area (GAME_DESIGN §8.4); rotated in portrait. */
export const VIEW_LONG = 1100;
export const VIEW_SHORT = 620;
/** Enemies spawn on a ring just outside the view, independent of aspect. */
export const SPAWN_RADIUS = VIEW_LONG / 2 + 80;
/** Enemies further than this from the player are recycled closer. */
export const DESPAWN_RADIUS = SPAWN_RADIUS * 1.6;

export const MAX_ENEMIES = 500;
