import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatInputCommandInteraction } from 'discord.js';
import { gameStore } from '../application';
import { commands, commandMap } from '../commands';
import { gameKey } from '../domain/game';

test('all command definitions load without Discord credentials and have unique names', () => {
  const names = commands.map((command) => command.data.name);
  assert.equal(new Set(names).size, names.length);
  assert.equal(commandMap.size, names.length);
  assert.equal(names.includes('draw'), false);
  assert.equal(names.includes('talk'), false);
  for (const command of commands) assert.equal(typeof command.data.toJSON, 'function');
});

test('/declare uses a player-local integer card slot from 1 through 3', () => {
  const declaration = commandMap.get('declare');
  assert.ok(declaration);
  const card = declaration.data.toJSON().options?.find((option) => option.name === 'card');
  assert.ok(card);
  assert.equal(card.type, 4);
  assert.equal(card.min_value, 1);
  assert.equal(card.max_value, 3);
});

test('/play uses the required integer number option from 1 through 100', async () => {
  const play = commandMap.get('play');
  assert.ok(play);
  const options = play.data.toJSON().options ?? [];
  const number = options.find((option) => option.name === 'number');
  assert.ok(number);
  assert.equal(number.type, 4);
  assert.equal(number.required, true);
  assert.equal(number.min_value, 1);
  assert.equal(number.max_value, 100);
  assert.equal(
    options.some((option) => option.name === 'card'),
    false,
  );

  const key = gameKey('command-test-guild', 'command-test-channel');
  const game = gameStore.create(
    key,
    'command-test-guild',
    'command-test-channel',
    'Easy',
    'player-1',
  );
  gameStore.join(key, 'player-2');
  gameStore.begin(key);
  for (const [userId, cards] of game.hands) {
    for (const card of cards) gameStore.declare(key, userId, card.slot, `表現-${card.slot}`);
  }
  const actualNumber = game.hands.get('player-1')![0]!.number;
  let requestedOption = '';
  let response = '';
  const interaction = {
    guildId: 'command-test-guild',
    channelId: 'command-test-channel',
    user: { id: 'player-1' },
    options: {
      getInteger(name: string, required: boolean): number {
        requestedOption = name;
        assert.equal(required, true);
        return actualNumber;
      },
    },
    reply: async (content: string): Promise<void> => {
      response = content;
    },
  } as unknown as ChatInputCommandInteraction;

  try {
    await play.execute(interaction);
  } finally {
    gameStore.delete(key);
  }
  assert.equal(requestedOption, 'number');
  assert.match(response, new RegExp(String(actualNumber)));
});
