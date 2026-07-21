import { REST, Routes } from 'discord.js';
import { commands } from '../commands';
import type { Logger } from '../logger';

export async function registerCommands(
  token: string,
  clientId: string,
  guildId: string | undefined,
  logger: Logger,
): Promise<void> {
  const body = commands.map((command) => command.data.toJSON());
  logger.info('Registering application commands', {
    scope: guildId ? 'guild' : 'global',
    names: body.map((command) => command.name),
  });
  const rest = new REST().setToken(token);
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);
  await rest.put(route, { body });
  logger.info('Application commands registered', { count: body.length });
}
