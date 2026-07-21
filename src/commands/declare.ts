import { SlashCommandBuilder } from 'discord.js';
import { gameStore } from '../application';
import { requireGuildContext } from './context';
import type { BotCommand } from './types';

export const declare: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('declare')
    .setDescription('手札のカードごとに数字を表す公開宣言を登録します')
    .addStringOption((option) =>
      option
        .setName('card')
        .setDescription('非公開のカードスロット（/handで確認）')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('clue').setDescription('数字を表す言葉').setRequired(true),
    ),
  async execute(interaction) {
    const { key } = requireGuildContext(interaction);
    const cardId = interaction.options.getString('card', true);
    const clue = interaction.options.getString('clue', true);
    gameStore.declare(key, interaction.user.id, cardId, clue);
    await interaction.reply(`宣言を更新しました: **${clue}**`);
  },
};
