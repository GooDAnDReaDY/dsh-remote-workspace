import test from 'node:test';
import assert from 'node:assert/strict';
import { openJumpChain, resolveJumpHops } from '../lib/jump-chain.js';

test('resolveJumpHops prefers the array and otherwise splits jumpHostId', () => {
  assert.deepEqual(resolveJumpHops({ jumpHosts: ['b', ' c '], jumpHostId: 'old' }), ['b', 'c']);
  assert.deepEqual(resolveJumpHops({ jumpHostId: 'a, b' }), ['a', 'b']);
  assert.deepEqual(resolveJumpHops({ jumpHostId: '' }), []);
});

test('openJumpChain forwards through each bastion and releases only later hops', async () => {
  const ended = [];
  const forwards = [];
  const fake = (id) => ({
    id,
    end() { ended.push(id); },
    forwardOut(_src, _port, host, _dest, cb) {
      forwards.push([id, host]);
      cb(null, { from: id, to: host });
    }
  });
  const opened = await openJumpChain(
    { host: 'target.internal', port: 22 },
    [{ id: 'edge', host: 'edge.example', port: 22 }, { id: 'core', host: 'core.internal', port: 22 }],
    {
      connectPooled: async () => fake('edge'),
      connectDedicated: async (hop) => fake(hop.id)
    }
  );
  assert.deepEqual(forwards, [['edge', 'core.internal'], ['core', 'target.internal']]);
  assert.equal(opened.sock.to, 'target.internal');
  opened.release();
  assert.deepEqual(ended, ['core']);
});
