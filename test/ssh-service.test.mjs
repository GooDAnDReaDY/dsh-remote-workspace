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
