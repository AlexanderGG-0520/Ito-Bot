import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { gameStore } from '../application';
import { requireGuildContext } from './context';
import type { BotCommand } from './types';

export const leave: BotCommand = {
  data: new SlashCommandBuilder().setName('leave').setDescription('現在のゲームから離脱します'),
  async execute(interaction) {
    const { key } = requireGuildContext(interaction);
    gameStore.leave(key, interaction.user.id);
    await interaction.reply({ content: 'ゲームから離脱しました。', flags: MessageFlags.Ephemeral });
  },
};
