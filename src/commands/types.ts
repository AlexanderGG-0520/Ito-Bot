import type { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export interface CommandData {
  readonly name: string;
  toJSON(): ReturnType<SlashCommandBuilder['toJSON']>;
}

export interface BotCommand {
  readonly data: CommandData;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
