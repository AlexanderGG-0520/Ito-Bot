import type { ChatInputCommandInteraction } from 'discord.js';
import { gameKey, type GameKey } from '../domain/game';

export function requireGuildContext(interaction: ChatInputCommandInteraction): {
  guildId: string;
  key: GameKey;
} {
  if (!interaction.guildId || !interaction.channelId) {
    throw new Error('このコマンドはDiscordサーバーのチャンネル内でのみ使用できます。');
  }
  return { guildId: interaction.guildId, key: gameKey(interaction.guildId, interaction.channelId) };
}
