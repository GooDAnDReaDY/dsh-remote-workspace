import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldPoll } from '../lib/poll-gate.js';

test('polling waits for a visible idle page', () => {
  assert.equal(shouldPoll({ hidden: false, inFlight: false }), true);
  assert.equal(shouldPoll({ hidden: true, inFlight: false }), false);
  assert.equal(shouldPoll({ hidden: false, inFlight: true }), false);
});
