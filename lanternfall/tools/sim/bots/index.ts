import type { Bot } from './bot';
import { StubBot } from './stub';

export const BOT_NAMES = ['stub'] as const;
export type BotName = (typeof BOT_NAMES)[number];

export function isBotName(name: string): name is BotName {
  return (BOT_NAMES as readonly string[]).includes(name);
}

export function createBot(name: BotName, seed: number): Bot {
  switch (name) {
    case 'stub':
      return new StubBot(seed);
  }
}
