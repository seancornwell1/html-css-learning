/**
 * Sim → presentation events. Render, audio and UI consume these and never
 * mutate sim state (CLAUDE.md, rule 2).
 */
export type SimEvent =
  | { type: 'enemy_spawned'; id: number; kind: number; x: number; y: number }
  | { type: 'enemy_killed'; id: number; kind: number; x: number; y: number }
  | { type: 'player_hit'; damage: number; hp: number }
  | { type: 'player_died'; time: number }
  | { type: 'victory'; time: number };

export class EventQueue {
  private items: SimEvent[] = [];

  push(event: SimEvent): void {
    this.items.push(event);
  }

  /** Hand all pending events to `fn`, then clear the queue. */
  drain(fn: (event: SimEvent) => void): void {
    const items = this.items;
    this.items = [];
    for (const e of items) fn(e);
  }

  get length(): number {
    return this.items.length;
  }

  clear(): void {
    this.items.length = 0;
  }
}
