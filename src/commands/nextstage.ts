import { SlashCommandBuilder } from 'discord.js';
import { gameStore } from '../application';
import { MAX_STAGE } from '../domain/game';
import { requireGuildContext } from './context';
import type { BotCommand } from './types';

export const nextStage: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('nextstage')
    .setDescription('参加者がそろったステージを準備します'),
  async execute(interaction) {
    const { key } = requireGuildContext(interaction);
    const current = gameStore.get(key);
    if (current && current.creatorId !== interaction.user.id) {
      throw new Error('ステージを準備できるのは主催者だけです。');
    }
    const game = gameStore.startStage(key);
    const momo =
      game.momoCard === undefined
        ? ''
        : `\nモモちゃんカード **${game.momoCard}** を場の脇に置きました。` +
          '\n全員で相談し、`/momo declaration:<表現>` で共有宣言してください。';
    await interaction.reply(
      `ステージ **${game.stage}/${MAX_STAGE}** を開始しました。\n` +
        `お題: **${game.currentTopic}**\nライフ: **${game.lives}**${momo}\n` +
        '参加者は `/hand` で自分の手札を確認してください。',
    );
  },
};
