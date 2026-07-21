import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { gameStore } from '../application';
import { requireGuildContext } from './context';
import type { BotCommand } from './types';

export const draw: BotCommand = {
  data: new SlashCommandBuilder().setName('draw').setDescription('自分の手札を確認します'),
  async execute(interaction) {
    const { key } = requireGuildContext(interaction);
    const hand = gameStore.hand(key, interaction.user.id);
    await interaction.reply({
      content: `あなたの手札: ${hand.map((card) => `${card.id}（${card.number}）`).join(', ') || 'なし'}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
