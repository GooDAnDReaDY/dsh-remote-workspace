import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MirrorSyncService } from '../lib/mirror-sync-service.js';

test('MirrorSyncService: pull properly computes binary file hashes without utf8 corruption', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drw-binary-test-'));
  const localDir = path.join(tmpDir, 'local');
  fs.mkdirSync(localDir);

  // Binary data with invalid UTF-8 sequences (e.g. raw byte 0xFF, 0xFE, 0xC0)
  const binaryBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const binaryFile = path.join(localDir, 'image.jpg');
  fs.writeFileSync(binaryFile, binaryBuffer);

  const mockRemoteFs = {
    async readFile(_profile, _path, encoding) {
      // Return binary buffer
      return binaryBuffer;
    }
  };

  const mockSsh = {
    async exec(_profile, _cmd, _cwd) {
      // Simulate remote scan returning image.jpg with size and mtime
      return {
        code: 0,
        stdout: `image.jpg\t${binaryBuffer.length}\t1700000000.00\n`,
        stderr: ''
      };
    }
  };

  const sync = new MirrorSyncService(mockRemoteFs, mockSsh);
  const res = await sync.pull({ id: 'p1' }, '/remote/workspace', localDir);

  assert.equal(res.success, true);
  assert.equal(res.conflicts.length, 0);

  // Snapshot must record the correct binary hash
  const snapshot = JSON.parse(fs.readFileSync(path.join(localDir, '.dsh-sync-snapshot.json'), 'utf8'));
  const expectedHash = sync.computeHash(binaryBuffer);
  assert.equal(snapshot['image.jpg'].hash, expectedHash);

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
