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

test('validateProxyCommandTemplate & expandProxyCommand: rejects shell injection and quotes tokens (Fixes #97)', () => {
  const { validateProxyCommandTemplate } = import('../lib/proxy-command.js');

  // 1. Template with shell operators is rejected
  assert.throws(() => {
    expandProxyCommand('connect %h; rm -rf /', { host: 'safe.host' });
  }, /ProxyCommand must not contain shell chaining/);

  assert.throws(() => {
    expandProxyCommand('nc %h `whoami`', { host: 'safe.host' });
  }, /ProxyCommand must not contain shell chaining/);

  assert.throws(() => {
    expandProxyCommand('nc %h $(id)', { host: 'safe.host' });
  }, /ProxyCommand must not contain shell chaining/);

  // 2. Tokens with shell injection characters are safely quoted
  const expanded = expandProxyCommand('nc %h %p', {
    host: 'host.example; rm -rf /',
    port: 22
  });
  assert.equal(expanded, "nc 'host.example; rm -rf /' 22");
});
