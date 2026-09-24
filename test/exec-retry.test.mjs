import test from 'node:test';
import assert from 'node:assert/strict';
import { isRetryableConnectionError, runWithReconnect } from '../lib/exec-retry.js';

test('connection resets retry and partial output does not', async () => {
  assert.equal(isRetryableConnectionError(Object.assign(new Error('connection reset'), { code: 'ECONNRESET' })), true);
  assert.equal(isRetryableConnectionError(Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' })), true);
  assert.equal(isRetryableConnectionError(Object.assign(new Error('command timed out'), { commandTimeout: true, code: 'COMMAND_TIMEOUT' })), false);
  assert.equal(isRetryableConnectionError(Object.assign(new Error('connection reset'), { stdout: 'started' })), false);

  let calls = 0;
  const value = await runWithReconnect(async () => {
    calls += 1;
    if (calls < 3) {
      const err = new Error('connection reset');
      err.code = 'ECONNRESET';
      throw err;
    }
    return 'ok';
  }, { wait: async () => {} });
  assert.equal(value, 'ok');
  assert.equal(calls, 3);

  await assert.rejects(() => runWithReconnect(async () => {
    const err = new Error('connection reset');
    err.code = 'ECONNRESET';
    throw err;
  }, { idempotent: false, wait: async () => {} }));
});
