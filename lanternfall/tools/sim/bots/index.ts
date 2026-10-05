import { AverageBot } from './average';
import type { Bot } from './bot';
import { NaiveBot } from './naive';
import { SkilledBot } from './skilled';

/**
 * `skilled_meta` is the skilled bot playing with every Shrine rank bought
 * (GAME_DESIGN §10's fourth band); run.ts passes the ranks to the sim.
 */
export const BOT_NAMES = ['naive', 'average', 'skilled', 'skilled_meta'] as const;
export type BotName = (typeof BOT_NAMES)[number];

export function isBotName(name: string): name is BotName {
  return (BOT_NAMES as readonly string[]).includes(name);
}

export function createBot(name: BotName, seed: number): Bot {
  switch (name) {
    case 'naive':
      return new NaiveBot(seed);
    case 'average':
      return new AverageBot(seed);
    case 'skilled':
    case 'skilled_meta':
      return new SkilledBot(seed);
  }
}
