/**
 * What a controller (human input or bot) wants this tick. The sim cannot
 * tell humans and bots apart (CLAUDE.md, rule 3).
 */
export interface Intent {
  /** Desired move direction; length is clamped to 1 by the sim. */
  moveX: number;
  moveY: number;
  /** Character active ability (e.g. Hotaru's dash). */
  action: boolean;
}

export const IDLE_INTENT: Readonly<Intent> = { moveX: 0, moveY: 0, action: false };
