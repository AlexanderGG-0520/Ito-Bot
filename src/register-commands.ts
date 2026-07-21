import { loadRegistrationConfig } from './config';
import { registerCommands } from './discord/registration';
import { createLogger } from './logger';

async function main(): Promise<void> {
  const config = loadRegistrationConfig();
  const logger = createLogger('info');
  await registerCommands(config.token, config.clientId, config.guildId, logger);
}

main().catch((error: unknown) => {
  const logger = createLogger('info');
  logger.error('Command registration failed', { error });
  process.exitCode = 1;
});
