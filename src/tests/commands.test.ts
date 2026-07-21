import assert from 'node:assert/strict';
import test from 'node:test';
import { commands, commandMap } from '../commands';

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
