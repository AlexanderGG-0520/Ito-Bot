import { SlashCommandBuilder } from 'discord.js';
import { gameStore, themeStore } from '../application';
import { MIN_PLAYERS } from '../domain/game';
import { requireGuildContext } from './context';
import type { BotCommand } from './types';

export const start: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('このチャンネルで新しいItoゲームを作成します'),
  async execute(interaction) {
    const { guildId, key } = requireGuildContext(interaction);
    const theme = themeStore.get(guildId);
    if (!theme) {
      await interaction.reply('先に `/theme` でお題テーマを設定してください。');
      return;
    }
    gameStore.create(key, guildId, interaction.channelId, theme, interaction.user.id);
    await interaction.reply(
      `ゲームロビーを作成しました（テーマ: **${theme}**）。主催者として参加済みです。\n` +
        `他の参加者は /join、${MIN_PLAYERS}人以上そろったら主催者が /begin を実行してください。`,
    );
  },
};
