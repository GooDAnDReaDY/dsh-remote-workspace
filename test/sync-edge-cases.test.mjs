import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MirrorSyncService } from '../lib/mirror-sync-service.js';

test('MirrorSyncService: conflict detection when both local and remote differ from baseline', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-sync-test-'));
  const localDir = path.join(tmpDir, 'local');
  fs.mkdirSync(localDir, { recursive: true });

  const sync = new MirrorSyncService({}, {});

  // Setup initial snapshot
  const baseline = {
    'index.js': sync.computeHash('initial content')
  };
  fs.writeFileSync(path.join(localDir, '.dsh-sync-snapshot.json'), JSON.stringify(baseline));

  // Local modified
  fs.writeFileSync(path.join(localDir, 'index.js'), 'local modified content');

  // Mock remoteFs and sshService
  const mockRemoteFs = {
    async readFile(profile, filePath) {
      return 'remote modified content';
    }
  };

  const mockSshService = {
    async exec(profile, cmd, cwd) {
      return {
        code: 0,
        stdout: 'index.js\t100\t123456\n',
        stderr: ''
      };
    }
  };

  const testSync = new MirrorSyncService(mockRemoteFs, mockSshService);
  const result = await testSync.pull({ id: 'test-machine' }, '/remote/path', localDir, true);

  // Assert conflict is reported and not silently overwritten
  assert.equal(result.success, false);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].path, 'index.js');
  assert.match(result.conflicts[0].reason, /Modified on both/);

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('MirrorSyncService: clean pull when only remote changed', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-sync-clean-'));
  const localDir = path.join(tmpDir, 'local');
  fs.mkdirSync(localDir, { recursive: true });

  const sync = new MirrorSyncService({}, {});

  // Setup initial snapshot: local is identical to baseline
  const baseContent = 'initial content';
  const baseline = {
    'app.js': sync.computeHash(baseContent)
  };
  fs.writeFileSync(path.join(localDir, '.dsh-sync-snapshot.json'), JSON.stringify(baseline));
  fs.writeFileSync(path.join(localDir, 'app.js'), baseContent);

  // Mock remote has updated version
  const mockRemoteFs = {
    async readFile(profile, filePath) {
      return 'new remote version';
    }
  };

  const mockSshService = {
    async exec(profile, cmd, cwd) {
      return {
        code: 0,
        stdout: 'app.js\t200\t123456\n',
        stderr: ''
      };
    }
  };

  const testSync = new MirrorSyncService(mockRemoteFs, mockSshService);
  const result = await testSync.pull({ id: 'test-machine' }, '/remote/path', localDir, false);

  assert.equal(result.success, true);
  assert.equal(result.conflicts.length, 0);
  assert.deepEqual(result.pulled, ['app.js']);

  // Local file should now contain updated content
  const updatedContent = fs.readFileSync(path.join(localDir, 'app.js'), 'utf8');
  assert.equal(updatedContent, 'new remote version');

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('MirrorSyncService: preserves binary data integrity without UTF-8 corruption', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-sync-binary-'));
  const localDir = path.join(tmpDir, 'local');
  fs.mkdirSync(localDir, { recursive: true });

  // Create binary data containing bytes that are invalid in UTF-8: 0x80, 0xFF, 0x00, 0xC0
  const binaryData = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0xFF, 0xFE, 0x80, 0xC3]);
  const filename = 'image.png';

  let savedRemoteBuffer = null;
  const mockRemoteFs = {
    async readFile(profile, filePath, encoding) {
      return binaryData;
    },
    async mkdir() {},
    async writeFile(profile, filePath, content) {
      savedRemoteBuffer = content;
    }
  };

  const mockSshService = {
    async exec() {
      return {
        code: 0,
        stdout: `${filename}\t${binaryData.length}\t1700000000\n`,
        stderr: ''
      };
    }
  };

  const sync = new MirrorSyncService(mockRemoteFs, mockSshService);

  // 1. Test clean pull of binary file
  const pullResult = await sync.pull({ id: 'p1' }, '/remote', localDir, false);
  assert.equal(pullResult.success, true);
  assert.deepEqual(pullResult.pulled, [filename]);

  const pulledLocalBuffer = fs.readFileSync(path.join(localDir, filename));
  assert.ok(Buffer.isBuffer(pulledLocalBuffer));
  assert.equal(Buffer.compare(pulledLocalBuffer, binaryData), 0, 'Pulled binary data must match byte-for-byte');

  // 2. Test push of binary file (force=true, dryRun=false)
  const pushResult = await sync.push({ id: 'p1' }, localDir, '/remote', true, false);
  assert.equal(pushResult.success, true);
  assert.deepEqual(pushResult.pushed, [filename]);
  assert.ok(Buffer.isBuffer(savedRemoteBuffer));
  assert.equal(Buffer.compare(savedRemoteBuffer, binaryData), 0, 'Pushed binary data must match byte-for-byte');

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
