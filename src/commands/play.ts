import { SlashCommandBuilder } from 'discord.js';
import { gameStore } from '../application';
import { requireGuildContext } from './context';
import type { BotCommand } from './types';

export const play: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('手札からカードを場に出します')
    .addIntegerOption((option) =>
      option
        .setName('number')
        .setDescription('自分の手札にある実際の数字')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true),
    ),
  async execute(interaction) {
    const { key } = requireGuildContext(interaction);
    const number = interaction.options.getInteger('number', true);
    const result = gameStore.play(key, interaction.user.id, number);
    const opening = result.status === 'start' ? '脱出開始！' : '次のカードを出してください。';
    const skipped =
      result.skippedCards.length > 0
        ? `\nストップ！出せなくなったカード: ${result.skippedCards.join(', ')}\n` +
          `失ったライフ: **${result.livesLost}**`
        : '';
    const outcome = result.lost
      ? '\nライフが0になりました。ゲームオーバーです。'
      : result.won
        ? '\n3rdステージをクリアしました。脱出成功です🎉'
        : result.stageCleared
          ? '\nステージクリア！主催者は `/nextstage` を実行してください。'
          : '';
    await interaction.reply(
      `**${result.playedCard}** を出しました。${opening}${skipped}${outcome}\n` +
        `現在のライフ: **${result.remainingLives}**`,
    );
  },
};
