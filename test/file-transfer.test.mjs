import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { attachmentName, contentDisposition, pipeWithProgress, transferPercent } from '../lib/file-transfer.js';

test('transfer progress and names stay bounded', async () => {
  assert.equal(transferPercent(1, 4), 25);
  assert.equal(transferPercent(0, 0), 0);
  assert.equal(attachmentName('/tmp/notes.txt'), 'notes.txt');
  assert.equal(attachmentName('/tmp/../'), 'download');
  assert.match(contentDisposition('/tmp/a.txt'), /filename="a.txt"/);

  const source = Readable.from([Buffer.from('abcd'), Buffer.from('ef')]);
  const chunks = [];
  const dest = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk);
      cb();
    }
  });
  assert.equal(await pipeWithProgress(source, dest), 6);

  const stalled = new Readable({ read() {} });
  const sink = new Writable({ write(_c, _e, cb) { cb(); } });
  const pending = pipeWithProgress(stalled, sink);
  stalled.push(Buffer.from('hi'));
  stalled.emit('aborted');
  await assert.rejects(pending, /aborted/);
});
