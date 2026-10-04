/**
 * Sim → presentation events. Render, audio and UI consume these and never
 * mutate sim state (CLAUDE.md, rule 2). Headless runs disable them.
 */
export type SimEvent =
  | { type: 'enemy_spawned'; slot: number; kind: number; x: number; y: number }
  | { type: 'enemy_hit'; slot: number; damage: number; x: number; y: number }
  | { type: 'enemy_killed'; slot: number; kind: number; x: number; y: number }
  | {
      type: 'sweep';
      weapon: number;
      x: number;
      y: number;
      angle: number;
      radius: number;
      arc: number;
    }
  | {
      type: 'whip';
      weapon: number;
      x: number;
      y: number;
      side: number;
      length: number;
      width: number;
    }
  | { type: 'nova'; weapon: number; x: number; y: number; radius: number }
  | {
      type: 'beam';
      weapon: number;
      x: number;
      y: number;
      angle: number;
      length: number;
      width: number;
    }
  | { type: 'strike'; weapon: number; x: number; y: number }
  | { type: 'chain'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'projectile_fired'; weapon: number; x: number; y: number }
  | { type: 'ember_collected'; value: number }
  | { type: 'pickup'; kind: number; x: number; y: number }
  | { type: 'reliquary'; rewards: string[] }
  | { type: 'evolution'; weapon: number; union: boolean }
  | { type: 'level_up'; level: number }
  | { type: 'upgrade_chosen'; label: string }
  | { type: 'player_hit'; damage: number; hp: number }
  | { type: 'revived'; x: number; y: number }
  | { type: 'player_died'; time: number }
  | { type: 'victory'; time: number }
  | { type: 'encircle'; kind: number }
  | { type: 'elite'; kind: number };

export class EventQueue {
  private items: SimEvent[] = [];

  constructor(public enabled = true) {}

  push(event: SimEvent): void {
    if (this.enabled) this.items.push(event);
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
