import { AverageBot } from './average';
import type { Bot } from './bot';
import { NaiveBot } from './naive';
import { SkilledBot } from './skilled';

export const BOT_NAMES = ['naive', 'average', 'skilled'] as const;
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
      return new SkilledBot(seed);
  }
}
