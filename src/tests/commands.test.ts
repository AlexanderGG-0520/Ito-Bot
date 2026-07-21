import assert from 'node:assert/strict';
import test from 'node:test';
import { commands, commandMap } from '../commands';

test('all command definitions load without Discord credentials and have unique names', () => {
  const names = commands.map((command) => command.data.name);
  assert.equal(new Set(names).size, names.length);
  assert.equal(commandMap.size, names.length);
  for (const command of commands) assert.equal(typeof command.data.toJSON, 'function');
});
