import { describe, expect, it } from 'vitest';
import { EventQueue, type SimEvent } from '../src/sim/events';

describe('EventQueue', () => {
  it('drains in order and empties', () => {
    const q = new EventQueue();
    q.push({ type: 'player_hit', damage: 1, hp: 9 });
    q.push({ type: 'player_died', time: 3 });
    const seen: SimEvent['type'][] = [];
    q.drain((e) => seen.push(e.type));
    expect(seen).toEqual(['player_hit', 'player_died']);
    expect(q.length).toBe(0);
  });
});
