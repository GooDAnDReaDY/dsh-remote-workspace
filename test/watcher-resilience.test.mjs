import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { WatcherService } from '../lib/watcher-service.js';

test('WatcherService: registers error listener and stops safely upon watcher error', () => {
  const service = new WatcherService();
  const mockWatcher = new EventEmitter();
  mockWatcher.close = () => { mockWatcher.closed = true; };

  const origWatch = fs.watch;
  const origExists = fs.existsSync;
  fs.existsSync = () => true;
  fs.watch = () => mockWatcher;

  try {
    const res = service.start({ id: 'p1', localMirrorPath: '/local', remoteWorkspace: '/remote' }, {});
    assert.equal(res.success, true);
    assert.equal(service.getStatus('p1'), true);

    // Emit error event on watcher (simulating ENOSPC or directory delete)
    mockWatcher.emit('error', new Error('ENOSPC: System limit for number of file watchers reached'));

    // Watcher should be safely stopped without unhandled crash
    assert.equal(service.getStatus('p1'), false);
    assert.equal(mockWatcher.closed, true);
  } finally {
    fs.watch = origWatch;
    fs.existsSync = origExists;
  }
});
