import { SlashCommandBuilder } from 'discord.js';
import { gameStore } from '../application';
import { requireGuildContext } from './context';
import type { BotCommand } from './types';

export const talk: BotCommand = {
  data: new SlashCommandBuilder().setName('talk').setDescription('フリートークタイムを開始します'),
  async execute(interaction) {
    const { key } = requireGuildContext(interaction);
    gameStore.hand(key, interaction.user.id);
    await interaction.reply(
      'フリートークタイム開始！相談してから `/play` でカードを出してください。',
    );
  },
};
