import test from 'node:test';
import assert from 'node:assert/strict';
import { TunnelService } from '../lib/tunnel-service.js';

test('TunnelService: tracks active tunnels list and stop behavior', () => {
  const tunnels = new TunnelService({});
  assert.deepEqual(tunnels.listActiveTunnels(), []);
  
  // Non-existent tunnel returns false
  assert.equal(tunnels.stopTunnel('fake:8080'), false);
});
