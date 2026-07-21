import { SlashCommandBuilder } from 'discord.js';
import { gameStore } from '../application';
import { MAX_STAGE } from '../domain/game';
import { requireGuildContext } from './context';
import type { BotCommand } from './types';

export const begin: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('begin')
    .setDescription('ロビーからステージ1を開始します'),
  async execute(interaction) {
    const { key } = requireGuildContext(interaction);
    const current = gameStore.get(key);
    if (current && current.creatorId !== interaction.user.id) {
      throw new Error('ゲームを開始できるのは主催者だけです。');
    }
    const game = gameStore.begin(key);
    await interaction.reply(
      `ステージ **${game.stage}/${MAX_STAGE}** を開始しました。\n` +
        `お題: **${game.currentTopic}**\nライフ: **${game.lives}**\n` +
        '参加者は `/hand` で自分の手札を確認し、カードごとに `/declare` を実行してください。',
    );
  },
};
