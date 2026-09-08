import test from 'node:test';
import assert from 'node:assert/strict';
import { MirrorSyncService } from '../lib/mirror-sync-service.js';

test('MirrorSyncService: calculates sha256 and checks ignores correctly', () => {
  const sync = new MirrorSyncService({}, {});
  
  const hash = sync.computeHash('hello world');
  assert.equal(typeof hash, 'string');
  assert.equal(hash.length, 64);

  assert.equal(sync.isIgnored('.git/config'), true);
  assert.equal(sync.isIgnored('node_modules/express/index.js'), true);
  assert.equal(sync.isIgnored('src/components/Button.tsx'), false);
  assert.equal(sync.isIgnored('app.pyc'), true);
});
