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
