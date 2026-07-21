import type { BotCommand } from './types';
import { begin } from './begin';
import { declare } from './declare';
import { end } from './end';
import { hand } from './hand';
import { help } from './help';
import { join } from './join';
import { leave } from './leave';
import { nextStage } from './nextstage';
import { momo } from './momo';
import { play } from './play';
import { reveal } from './reveal';
import { start } from './start';
import { theme } from './theme';

export const commands: readonly BotCommand[] = [
  begin,
  declare,
  end,
  hand,
  help,
  join,
  leave,
  momo,
  nextStage,
  play,
  reveal,
  start,
  theme,
];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
