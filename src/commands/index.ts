import type { BotCommand } from './types';
import { begin } from './begin';
import { declare } from './declare';
import { draw } from './draw';
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
import { talk } from './talk';
import { theme } from './theme';

export const commands: readonly BotCommand[] = [
  begin,
  declare,
  draw,
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
  talk,
  theme,
];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
