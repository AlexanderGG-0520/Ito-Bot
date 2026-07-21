import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { themeStore } from '../application';
import { themes } from '../domain/topic-manager';
import type { BotCommand } from './types';

export const theme: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('theme')
    .setDescription('このサーバーのゲームテーマを設定します')
    .addStringOption((option) =>
      option
        .setName('topic')
        .setDescription('テーマ')
        .setRequired(true)
        .addChoices(...themes.map((value) => ({ name: value, value }))),
    ),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'サーバー内でのみ使用できます。',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const selected = interaction.options.getString('topic', true);
    themeStore.set(interaction.guildId, selected);
    await interaction.reply(`お題テーマを **${selected}** に設定しました。`);
  },
};
