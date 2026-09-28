import test from 'node:test';
import assert from 'node:assert/strict';
import { TunnelService } from '../lib/tunnel-service.js';

test('TunnelService: tracks active tunnels list and stop behavior', () => {
  const tunnels = new TunnelService({});
  assert.deepEqual(tunnels.listActiveTunnels(), []);
  
  // Non-existent tunnel returns false
  assert.equal(tunnels.stopTunnel('fake:8080'), false);
});

test('TunnelService: connection cleanup destroys counterparts and decrements counter exactly once', async () => {
  const EventEmitter = (await import('node:events')).EventEmitter;
  const tunnels = new TunnelService({
    getConnection: async () => ({
      forwardOut: (_src, _srcPort, _dst, _dstPort, cb) => {
        const stream = new EventEmitter();
        stream.pipe = () => {}; stream.destroy = () => { stream.destroyed = true; stream.emit('close'); };
        cb(null, stream);
      }
    }),
    setPinned: () => {}
  });

  // Mock server
  let connectionHandler;
  const mockServer = new EventEmitter();
  mockServer.listen = (_port, _host, cb) => cb();
  mockServer.close = () => {};

  const net = await import('node:net');
  const origCreateServer = net.default.createServer;
  net.default.createServer = (handler) => {
    connectionHandler = handler;
    return mockServer;
  };

  try {
    const res = await tunnels.startLocalTunnel({ id: 'p1' }, 19999, 'remotehost', 80);
    assert.equal(res.success, true);

    const tunnelMeta = tunnels.activeTunnels.get('p1:19999->remotehost:80');
    assert.ok(tunnelMeta);

    // Simulate clientSocket connection
    const clientSocket = new EventEmitter();
    clientSocket.pipe = () => {};
    clientSocket.destroy = () => { clientSocket.destroyed = true; clientSocket.emit('close'); };

    connectionHandler(clientSocket);
    assert.equal(tunnelMeta.activeConnections, 1);
    assert.equal(tunnelMeta.totalConnections, 1);

    // Emit both error and close on clientSocket
    clientSocket.emit('error', new Error('client reset'));
    clientSocket.emit('close');

    // activeConnections must be 0, NOT negative or double-decremented
    assert.equal(tunnelMeta.activeConnections, 0);

    tunnels.stopAll();
  } finally {
    net.default.createServer = origCreateServer;
  }
});
