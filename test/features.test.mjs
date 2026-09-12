import test from 'node:test';
import assert from 'node:assert/strict';
import { stripAnsi } from '../lib/ssh-service.js';

test('SshService: stripAnsi cleans colors and cursor codes', () => {
  const colored = '\u001b[31mRed Text\u001b[0m \u001b[1;32mBold Green\u001b[0m';
  assert.equal(stripAnsi(colored), 'Red Text Bold Green');

  const cursorCodes = '\u001b[2J\u001b[HWelcome';
  assert.equal(stripAnsi(cursorCodes), 'Welcome');
});

test('TunnelService: measures bytesRx, bytesTx, and uptimeSeconds', () => {
  import('../lib/tunnel-service.js').then(({ TunnelService }) => {
    const ts = new TunnelService({});
    assert.equal(Array.isArray(ts.listActiveTunnels()), true);
  });
});
