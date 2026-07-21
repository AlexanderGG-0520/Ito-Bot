import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../config';

test('configuration requires a new token and client id without revealing values', () => {
  const previousToken = process.env.DISCORD_TOKEN;
  const previousClient = process.env.DISCORD_CLIENT_ID;
  delete process.env.DISCORD_TOKEN;
  delete process.env.DISCORD_CLIENT_ID;
  assert.throws(() => loadConfig(), /DISCORD_TOKEN is required/);
  if (previousToken === undefined) delete process.env.DISCORD_TOKEN;
  else process.env.DISCORD_TOKEN = previousToken;
  if (previousClient === undefined) delete process.env.DISCORD_CLIENT_ID;
  else process.env.DISCORD_CLIENT_ID = previousClient;
});
