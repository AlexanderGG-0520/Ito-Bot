import { SlashCommandBuilder } from 'discord.js';
import { gameStore } from '../application';
import { requireGuildContext } from './context';
import type { BotCommand } from './types';

export const end: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('end')
    .setDescription('このチャンネルのゲームを終了します'),
  async execute(interaction) {
    const { key } = requireGuildContext(interaction);
    const game = gameStore.get(key);
    if (!game) {
      await interaction.reply('このチャンネルではゲームがありません。');
      return;
    }
    if (game.creatorId !== interaction.user.id) {
      await interaction.reply('ゲームを終了できるのは主催者だけです。');
      return;
    }
    const result = gameStore.checkEnd(key);
    gameStore.delete(key);
    await interaction.reply(
      result === 'win'
        ? '脱出成功！全員勝利です🎉'
        : result === 'lose'
          ? 'ゲームオーバー…脱出失敗でした💥'
          : 'ゲームを終了しました。',
    );
  },
};
