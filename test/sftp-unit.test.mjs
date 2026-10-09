import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { RemoteFsService } from '../lib/remote-fs-service.js';

test('RemoteFsService: readFile reads stream buffer correctly', async () => {
  const fileContent = 'file contents from mock sftp stream';
  const mockSftp = {
    createReadStream(path) {
      return Readable.from([Buffer.from(fileContent, 'utf8')]);
    }
  };

  const mockSshService = {
    async getSftp() {
      return mockSftp;
    }
  };

  const remoteFs = new RemoteFsService(mockSshService);
  const result = await remoteFs.readFile({}, '/fake/remote/path.txt', 'utf8');
  assert.equal(result, fileContent);
});

test('RemoteFsService: stat returns directory and file flags accurately', async () => {
  const mockSftp = {
    stat(path, cb) {
      if (path === '/dir') {
        cb(null, { mode: 0o040755, size: 4096, mtime: 1700000000 });
      } else {
        cb(null, { mode: 0o100644, size: 1024, mtime: 1700000001 });
      }
    }
  };

  const mockSshService = {
    async getSftp() {
      return mockSftp;
    }
  };

  const remoteFs = new RemoteFsService(mockSshService);
  const dirStat = await remoteFs.stat({}, '/dir');
  assert.equal(dirStat.isDirectory, true);
  assert.equal(dirStat.isFile, false);
  assert.equal(dirStat.size, 4096);

  const fileStat = await remoteFs.stat({}, '/file.txt');
  assert.equal(fileStat.isDirectory, false);
  assert.equal(fileStat.isFile, true);
  assert.equal(fileStat.size, 1024);
});

test('RemoteFsService: writeFile writes to temp and renames atomically', async () => {
  let writtenData = '';
  let renamedFrom = '';
  let renamedTo = '';

  const mockSftp = {
    createWriteStream(tempPath) {
      const w = new Writable({
        write(chunk, encoding, callback) {
          writtenData += chunk.toString();
          callback();
        }
      });
      return w;
    },
    rename(oldPath, newPath, cb) {
      renamedFrom = oldPath;
      renamedTo = newPath;
      cb(null);
    }
  };

  const mockSshService = {
    async getSftp() {
      return mockSftp;
    }
  };

  const remoteFs = new RemoteFsService(mockSshService);
  const res = await remoteFs.writeFile({}, '/app/server.js', 'console.log(123)');

  assert.equal(res.success, true);
  assert.equal(writtenData, 'console.log(123)');
  assert.match(renamedFrom, /\/app\/server\.js\.dsh-tmp\./);
  assert.equal(renamedTo, '/app/server.js');
});

test('RemoteFsService: list alias calls listDir correctly', async () => {
  const mockSftp = {
    readdir(path, cb) {
      cb(null, [
        { filename: 'index.js', attrs: { mode: 0o100644, size: 512, mtime: 1700000000 } },
        { filename: 'lib', attrs: { mode: 0o040755, size: 4096, mtime: 1700000001 } }
      ]);
    }
  };

  const mockSshService = {
    async getSftp() {
      return mockSftp;
    }
  };

  const remoteFs = new RemoteFsService(mockSshService);
  const entries = await remoteFs.list({ id: 'test' }, '/app');
  assert.equal(entries.length, 2);
  assert.equal(entries[0].filename, 'index.js');
  assert.equal(entries[0].isFile, true);
  assert.equal(entries[1].filename, 'lib');
  assert.equal(entries[1].isDirectory, true);
});

test('RemoteFsService: readFile rejects with ERR_FILE_TOO_LARGE when exceeding maxBytes (Fixes #99)', async () => {
  const hugeChunk = Buffer.alloc(1024 * 1024, 'x'); // 1MB chunk
  const mockSftp = {
    createReadStream() {
      return Readable.from([hugeChunk, hugeChunk, hugeChunk]);
    }
  };
  const mockSsh = { async getSftp() { return mockSftp; } };
  const remoteFs = new RemoteFsService(mockSsh);

  // Set cap to 2MB, provided 3MB -> should reject
  await assert.rejects(async () => {
    await remoteFs.readFile({}, '/fake/huge.bin', 'utf8', 2 * 1024 * 1024);
  }, /ERR_FILE_TOO_LARGE/);
});

test('RemoteFsService: invalidateCache precisely invalidates subpath without substring over-invalidation (Fixes #98)', () => {
  const remoteFs = new RemoteFsService({});
  const now = Date.now() + 60000;

  // Populate cache with multiple keys
  remoteFs.cache.set('p1:list:/workspace/src', { data: [], expiresAt: now });
  remoteFs.cache.set('p1:stat:/workspace/src/app.js', { data: {}, expiresAt: now });
  remoteFs.cache.set('p1:list:/workspace/src-other', { data: [], expiresAt: now });
  remoteFs.cache.set('p1:stat:/workspace/other/app.js', { data: {}, expiresAt: now });
  remoteFs.cache.set('p2:list:/workspace/src', { data: [], expiresAt: now });

  // Invalidate /workspace/src for p1
  remoteFs.invalidateCache('p1', '/workspace/src');

  // Exact path and child paths must be deleted
  assert.equal(remoteFs.cache.has('p1:list:/workspace/src'), false);
  assert.equal(remoteFs.cache.has('p1:stat:/workspace/src/app.js'), false);

  // Substring match prefix like /workspace/src-other must NOT be deleted
  assert.equal(remoteFs.cache.has('p1:list:/workspace/src-other'), true, 'Must not over-invalidate sibling directories');
  assert.equal(remoteFs.cache.has('p1:stat:/workspace/other/app.js'), true, 'Must not invalidate other directories');
  assert.equal(remoteFs.cache.has('p2:list:/workspace/src'), true, 'Must not invalidate other profiles');

  // Full invalidation for p1
  remoteFs.invalidateCache('p1');
  assert.equal(remoteFs.cache.has('p1:list:/workspace/src-other'), false);
  assert.equal(remoteFs.cache.has('p1:stat:/workspace/other/app.js'), false);
  assert.equal(remoteFs.cache.has('p2:list:/workspace/src'), true);

  // Global invalidation
  remoteFs.invalidateCache(null);
  assert.equal(remoteFs.cache.size, 0);
});
