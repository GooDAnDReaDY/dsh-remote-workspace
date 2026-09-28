import test from 'node:test';
import assert from 'node:assert/strict';
import { SshService } from '../lib/ssh-service.js';

test('Terminal: sweepAbandonedTerminalSessions reaps sessions with no subscribers after idle timeout', () => {
  const service = new SshService({});
  let closedSession1 = false;
  let closedSession2 = false;

  const session1 = {
    id: 'term_1',
    createdAt: 1000,
    lastActive: 1000,
    subscribers: new Set(),
    close: () => { closedSession1 = true; }
  };

  const session2 = {
    id: 'term_2',
    createdAt: 1000,
    lastActive: 1000,
    subscribers: new Set([() => {}]), // active subscriber
    close: () => { closedSession2 = true; }
  };

  service.terminalSessions.set('term_1', session1);
  service.terminalSessions.set('term_2', session2);

  // At 5 minutes: session1 is not yet timed out (10 min timeout)
  const swept1 = service.sweepAbandonedTerminalSessions(1000 + 5 * 60 * 1000);
  assert.equal(swept1.length, 0);
  assert.equal(closedSession1, false);

  // At 11 minutes: session1 (0 subscribers, idle 11m) is swept, session2 has subscribers so kept
  const swept2 = service.sweepAbandonedTerminalSessions(1000 + 11 * 60 * 1000);
  assert.deepEqual(swept2, ['term_1']);
  assert.equal(closedSession1, true);
  assert.equal(closedSession2, false);
  assert.equal(service.terminalSessions.has('term_1'), false);
  assert.equal(service.terminalSessions.has('term_2'), true);
});
