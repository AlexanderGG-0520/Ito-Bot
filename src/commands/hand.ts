import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { gameStore } from '../application';
import { requireGuildContext } from './context';
import type { BotCommand } from './types';

export const hand: BotCommand = {
  data: new SlashCommandBuilder().setName('hand').setDescription('自分の現在の手札を確認します'),
  async execute(interaction) {
    const { key } = requireGuildContext(interaction);
    const cards = gameStore.hand(key, interaction.user.id);
    await interaction.reply({
      content: `あなたの手札: ${cards.map((card) => `カード${card.slot}（${card.number}）`).join('、') || 'なし'}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
