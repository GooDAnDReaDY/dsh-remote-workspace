import test from 'node:test';
import assert from 'node:assert/strict';
import { SshService } from '../lib/ssh-service.js';

test('sweepIdle closes only unused connections', () => {
  const service = new SshService({});
  service.idleTimeoutMs = 1000;
  const ended = [];
  const fake = (id) => ({ end() { ended.push(id); } });
  service.connections.set('old', fake('old'));
  service.connMeta.set('old', { lastUsed: 0, inFlight: 0, pinned: false });
  service.connections.set('busy', fake('busy'));
  service.connMeta.set('busy', { lastUsed: 0, inFlight: 1, pinned: false });
  service.connections.set('held', fake('held'));
  service.connMeta.set('held', { lastUsed: 0, inFlight: 0, pinned: true });
  service.connections.set('fresh', fake('fresh'));
  service.connMeta.set('fresh', { lastUsed: 4500, inFlight: 0, pinned: false });
  assert.deepEqual(service.sweepIdle(5000), ['old']);
  assert.deepEqual(ended, ['old']);
  assert.equal(service.connections.has('busy'), true);
  assert.equal(service.connections.has('held'), true);
  assert.equal(service.connections.has('fresh'), true);
});
