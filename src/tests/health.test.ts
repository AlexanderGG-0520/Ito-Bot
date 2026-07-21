import assert from 'node:assert/strict';
import test from 'node:test';
import { HealthServer } from '../health';

test('health and readiness endpoints expose distinct process states', async () => {
  const health = new HealthServer(0, '127.0.0.1');
  await health.start();
  const port = health.address?.port;
  assert.ok(port);
  const healthResponse = await fetch(`http://127.0.0.1:${port}/healthz`);
  const readyResponse = await fetch(`http://127.0.0.1:${port}/readyz`);
  assert.equal(healthResponse.status, 200);
  assert.equal(readyResponse.status, 503);
  health.setReady(true);
  const readyResponseAfterStart = await fetch(`http://127.0.0.1:${port}/readyz`);
  assert.equal(readyResponseAfterStart.status, 200);
  await health.stop();
});
