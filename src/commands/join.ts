import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { gameStore } from '../application';
import { requireGuildContext } from './context';
import type { BotCommand } from './types';

export const join: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('現在のチャンネルのゲームに参加します'),
  async execute(interaction) {
    const { key } = requireGuildContext(interaction);
    const game = gameStore.join(key, interaction.user.id);
    await interaction.reply({
      content: `参加しました（${game.players.length}人）。主催者が /begin でステージ1を開始できます。`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
