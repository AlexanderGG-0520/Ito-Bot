import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ButtonInteraction,
} from 'discord.js';
import type { BotCommand } from './types';

const pages = [
  ['Itoの遊び方', '数字を小さい順に出しながら、お題に沿って数字の大きさを表現します。'],
  [
    'ロビー',
    '`/theme` → `/start` → `/join`。2〜10人そろったら主催者が `/begin` でステージ1を開始します。',
  ],
  [
    'ステージ',
    '全員の手札がなくなると待機状態になり、主催者が `/nextstage`。ステージ3をクリアすると勝利です。',
  ],
  [
    '宣言とカード',
    '`/hand` で非公開のカードスロットと数字を確認し、`/declare card:<1-3> clue:<表現>` で宣言します。全員の未プレイカードを宣言してから `/play number:<数字>` を使います。`card` はスロット、`number` は実際の数字です。手札は本人だけが見られ、プレイ時に数字が公開されます。',
  ],
  [
    '失敗',
    'カードを出すと、それより小さいまま残っている手札が廃棄され、その枚数だけライフを失います。場は続きます。',
  ],
  [
    'モモちゃん',
    'ステージ3では公開されたモモちゃんの数字を `/momo` で全員の共有宣言にします。モモちゃんはプレイしません。',
  ],
  ['状態', 'ゲームはチャンネルごとに独立します。Pod再起動時は進行中のゲームが失われます。'],
] as const;

function row(page: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ito:help:prev:${page}`)
      .setLabel('戻る')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`ito:help:next:${page}`)
      .setLabel('次へ')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === pages.length - 1),
  );
}

export function helpPage(page: number): EmbedBuilder {
  const [title, description] = pages[page] ?? pages[0];
  return new EmbedBuilder().setTitle(title).setDescription(description).setColor(0x3498db);
}

export async function handleHelpButton(interaction: ButtonInteraction): Promise<void> {
  const match = /^ito:help:(prev|next):(\d+)$/.exec(interaction.customId);
  if (!match) throw new Error('Invalid help button');
  const current = Number(match[2]);
  const page = match[1] === 'next' ? current + 1 : current - 1;
  if (page < 0 || page >= pages.length) throw new Error('Invalid help page');
  await interaction.update({ embeds: [helpPage(page)], components: [row(page)] });
}

export const help: BotCommand = {
  data: new SlashCommandBuilder().setName('help').setDescription('Itoの遊び方を表示します'),
  async execute(interaction) {
    await interaction.reply({
      embeds: [helpPage(0)],
      components: [row(0)],
      flags: MessageFlags.Ephemeral,
    });
  },
};
