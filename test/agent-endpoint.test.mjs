import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveAgentEndpoint } from '../lib/agent-endpoint.js';

test('resolveAgentEndpoint uses the socket, Pageant, or SSH_AUTH_SOCK', () => {
  assert.equal(resolveAgentEndpoint({ authType: 'key', agentPath: '/tmp/agent' }, {}, 'linux'), undefined);
  assert.equal(resolveAgentEndpoint({ authType: 'agent', agentPath: '/tmp/agent.sock' }, {}, 'linux'), '/tmp/agent.sock');
  assert.equal(resolveAgentEndpoint({ authType: 'agent', agentPath: 'pageant' }, { SSH_AUTH_SOCK: '/tmp/a' }, 'linux'), 'pageant');
  assert.equal(resolveAgentEndpoint({ authType: 'agent' }, { SSH_AUTH_SOCK: '/tmp/a' }, 'linux'), '/tmp/a');
  assert.equal(resolveAgentEndpoint({ authType: 'agent' }, {}, 'win32'), 'pageant');
  assert.equal(resolveAgentEndpoint({ authType: 'agent' }, {}, 'linux'), undefined);
});

test('agent auth does not place a private key into the connection config', () => {
  const src = readFileSync(new URL('../lib/ssh-service.js', import.meta.url), 'utf8');
  const start = src.indexOf("} else if (profile.authType === 'agent')");
  const end = src.indexOf('} else {', start);
  const agentBranch = src.slice(start, end);
  assert.match(agentBranch, /resolveAgentEndpoint/);
  assert.equal(agentBranch.includes('privateKey'), false);
});
