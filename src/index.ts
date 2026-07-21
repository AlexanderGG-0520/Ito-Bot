import {
  ActivityType,
  Client,
  GatewayIntentBits,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { commandMap } from './commands';
import { handleHelpButton } from './commands/help';
import { loadConfig } from './config';
import { createLogger } from './logger';
import { HealthServer } from './health';

const config = loadConfig();
const logger = createLogger(config.logLevel);
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const health = new HealthServer(config.port, config.host);
let shuttingDown = false;
let statusInterval: NodeJS.Timeout | undefined;

async function respondWithError(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : '予期しないエラーが発生しました。';
  const command = interaction.isChatInputCommand() ? interaction.commandName : 'button';
  logger.error('Interaction failed', { command, error });
  const payload = { content: message, flags: MessageFlags.Ephemeral } as const;
  try {
    if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
    else await interaction.reply(payload);
  } catch (replyError: unknown) {
    logger.warn('Unable to acknowledge interaction error', { error: replyError });
  }
}

async function handleInteraction(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commandMap.get(interaction.commandName);
      if (!command) throw new Error('このコマンドは現在利用できません。');
      await command.execute(interaction);
      return;
    }
    if (interaction.isButton() && interaction.customId.startsWith('ito:help:')) {
      await handleHelpButton(interaction);
    }
  } catch (error: unknown) {
    await respondWithError(interaction, error);
  }
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  health.setReady(false);
  if (statusInterval) clearInterval(statusInterval);
  logger.info('Shutdown started', { signal });
  const timeout = setTimeout(() => {
    logger.error('Shutdown timed out');
    process.exit(1);
  }, 10_000);
  timeout.unref();
  try {
    await health.stop();
    client.destroy();
    logger.info('Shutdown completed');
  } finally {
    clearTimeout(timeout);
  }
}

process.on('uncaughtException', (error: unknown) => {
  logger.error('Uncaught exception; terminating', { error });
  process.exitCode = 1;
  void shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection; terminating', { error: reason });
  process.exitCode = 1;
  void shutdown('unhandledRejection');
});
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

client.once('ready', () => {
  health.setReady(true);
  client.user?.setActivity('ito', { type: ActivityType.Playing });
  statusInterval = setInterval(() => {
    client.user?.setActivity(`${client.guilds.cache.size} servers`, { type: ActivityType.Playing });
  }, 30_000);
  logger.info('Discord client ready', { guilds: client.guilds.cache.size });
});
client.on('interactionCreate', (interaction) => {
  if (interaction.isChatInputCommand() || interaction.isButton())
    void handleInteraction(interaction);
});

async function main(): Promise<void> {
  await health.start();
  logger.info('Health server listening', { host: config.host, port: config.port });
  await client.login(config.token);
}

void main().catch((error: unknown) => {
  logger.error('Fatal startup failure', { error });
  process.exitCode = 1;
  void shutdown('startup failure');
});
