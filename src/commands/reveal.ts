import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { gameStore } from '../application';
import { requireGuildContext } from './context';
import type { BotCommand } from './types';

export const reveal: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('reveal')
    .setDescription('場に出されたカードを公開します'),
  async execute(interaction) {
    const { key } = requireGuildContext(interaction);
    const game = gameStore.get(key);
    if (!game || game.pile.length === 0) {
      await interaction.reply({
        content: 'まだカードが場に出されていません。',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('📣 場のカード')
          .setDescription(game.pile.join('、'))
          .setColor(0xe74c3c),
      ],
    });
  },
};
