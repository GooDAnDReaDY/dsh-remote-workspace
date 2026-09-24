import test from 'node:test';
import assert from 'node:assert/strict';
import { SshService } from '../lib/ssh-service.js';

test('SshService: resolves private keys properly', () => {
  const service = new SshService({});
  const directKey = '-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----';
  
  const res1 = service.resolvePrivateKey({ privateKey: directKey });
  assert.equal(res1, directKey);

  const res2 = service.resolvePrivateKey({ privateKeyPath: '/non/existent/path/key' });
  assert.equal(res2, undefined);
});

test('SshService: createTerminalSession accepts both options object and positional numbers', async () => {
  const service = new SshService({});
  let passedShellOpts = null;
  service.connectDedicated = async () => ({
    end() {},
    shell(opts, cb) {
      passedShellOpts = opts;
      cb(null, {
        write() {},
        end() {},
        setWindow() {},
        on() {}
      });
    }
  });

  const session1 = await service.createTerminalSession({ id: 'p1' }, { cols: 100, rows: 30 });
  assert.equal(passedShellOpts.cols, 100);
  assert.equal(passedShellOpts.rows, 30);
  assert.ok(session1.id.startsWith('term_'));

  const session2 = await service.createTerminalSession({ id: 'p1' }, 110, 35);
  assert.equal(passedShellOpts.cols, 110);
  assert.equal(passedShellOpts.rows, 35);
  assert.ok(session2.id.startsWith('term_'));
});
