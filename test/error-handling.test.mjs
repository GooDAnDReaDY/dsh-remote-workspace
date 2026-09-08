import test from 'node:test';
import assert from 'node:assert/strict';
import { SshService } from '../lib/ssh-service.js';
import { RemoteFsService } from '../lib/remote-fs-service.js';

test('SshService: disconnectAll closes all active connections cleanly', () => {
  const service = new SshService({});
  let ended = false;
  service.connections.set('host-1', {
    end() { ended = true; }
  });
  service.sftpSessions.set('host-1', {});

  service.disconnectAll();
  assert.equal(ended, true);
  assert.equal(service.connections.size, 0);
  assert.equal(service.sftpSessions.size, 0);
});

test('RemoteFsService: handles command failure on mkdir properly', async () => {
  const mockSsh = {
    async exec(profile, cmd) {
      return { code: 1, stderr: 'Permission denied', stdout: '' };
    }
  };
  const fsService = new RemoteFsService(mockSsh);
  await assert.rejects(
    async () => {
      await fsService.mkdir({}, '/root/forbidden');
    },
    /Permission denied/
  );
});
