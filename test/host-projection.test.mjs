import test from 'node:test';
import assert from 'node:assert/strict';
import { renderHostTable, toAgentHostRow, hostProjectionLeaks } from '../lib/host-projection.js';

test('toAgentHostRow hides secrets and bastion commands', () => {
  const profile = {
    name: 'edge',
    host: '10.0.0.5',
    port: 22,
    username: 'dev',
    authType: 'agent',
    password: 'secret-password',
    privateKey: 'SECRET-KEY',
    proxyCommand: 'cloudflared access ssh --hostname %h',
    jumpHostId: 'bastion',
    environment: 'prod',
    tags: ['web'],
    description: 'edge node'
  };
  const row = toAgentHostRow(profile);
  const table = renderHostTable([profile]);
  const packed = JSON.stringify(row) + table;
  assert.equal(packed.includes('secret-password'), false);
  assert.equal(packed.includes('SECRET-KEY'), false);
  assert.equal(packed.includes('cloudflared'), false);
  assert.equal(row.access, 'jump,proxy');
  assert.match(table, /alias \| host \| port \| user \| auth \| jump\/proxy \| env \| tags \| description/);
  assert.match(table, /edge \| 10\.0\.0\.5 \| 22 \| dev \| agent \| jump,proxy \| prod \| web \| edge node/);
});

test('hostProjectionLeaks verifies secret masking', () => {
  assert.equal(hostProjectionLeaks({ password: 'secret' }), true);
  assert.equal(hostProjectionLeaks({ privateKey: 'secret' }), true);
  const safeRow = toAgentHostRow({ id: 'p1', name: 'host1', host: '10.0.0.1' });
  assert.equal(hostProjectionLeaks(safeRow), false);
});
