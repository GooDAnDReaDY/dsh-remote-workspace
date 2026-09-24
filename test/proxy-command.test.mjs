import test from 'node:test';
import assert from 'node:assert/strict';
import { expandProxyCommand, openProxyCommand } from '../lib/proxy-command.js';

test('expandProxyCommand substitutes OpenSSH tokens and keeps a literal percent', () => {
  const expanded = expandProxyCommand('connect %h %p %r %n %%h', {
    host: 'edge.example',
    port: 2222,
    user: 'dev',
    alias: 'edge'
  });
  assert.equal(expanded, 'connect edge.example 2222 dev edge %h');
});

test('openProxyCommand runs a process and stops it when the socket closes', async () => {
  const opened = openProxyCommand('sleep 30');
  assert.equal(opened.child.exitCode, null);
  opened.stop();
  const signal = await new Promise((resolve) => opened.child.once('exit', (_code, sig) => resolve(sig)));
  assert.ok(signal);
});
