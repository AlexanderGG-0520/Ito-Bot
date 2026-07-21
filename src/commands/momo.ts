import { SlashCommandBuilder } from 'discord.js';
import { gameStore } from '../application';
import { requireGuildContext } from './context';
import type { BotCommand } from './types';

export const momo: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('momo')
    .setDescription('ステージ3のモモちゃんの共有宣言を設定します')
    .addStringOption((option) =>
      option
        .setName('declaration')
        .setDescription('全員で決めたモモちゃんの表現')
        .setRequired(true),
    ),
  async execute(interaction) {
    const { key } = requireGuildContext(interaction);
    const declaration = interaction.options.getString('declaration', true);
    gameStore.declareMomo(key, interaction.user.id, declaration);
    await interaction.reply(`モモちゃんの共有宣言を更新しました: **${declaration}**`);
  },
};
