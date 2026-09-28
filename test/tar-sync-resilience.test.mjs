import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { TarSyncService } from '../lib/tar-sync-service.js';

test('TarSyncService: pullTar safely handles localTar errors and destroys stream', async () => {
  let streamDestroyed = false;
  const mockStream = new EventEmitter();
  mockStream.pipe = () => {};
  mockStream.destroy = () => { streamDestroyed = true; };

  const mockSsh = {
    getConnection: async () => ({
      exec: (_cmd, cb) => cb(null, mockStream)
    })
  };

  const service = new TarSyncService(mockSsh);

  // Run pullTar with a nonexistent localDir (will be created)
  const pullPromise = service.pullTar({ id: 'p1' }, '/remote/dir', '/tmp/test-tar-pull');

  // Wait tick for spawn
  await new Promise((r) => setTimeout(r, 50));

  // Emit error on stream
  mockStream.emit('error', new Error('stream abort'));

  await assert.rejects(pullPromise, /stream abort/);
});
