import test from 'node:test';
import assert from 'node:assert/strict';
import { DockerService } from '../lib/docker-service.js';
import { DiagnoseService } from '../lib/diagnose-service.js';
import { RemoteFsService } from '../lib/remote-fs-service.js';

test('Security: DockerService sanitizes tail and containerId against injection', async () => {
  let executedCmd = '';
  const mockSsh = {
    exec: async (_profile, cmd) => {
      executedCmd = cmd;
      return { code: 0, stdout: '', stderr: '' };
    }
  };

  const docker = new DockerService(mockSsh);
  // Attempt injection via tail and containerId
  await docker.containerLogs({ id: 'p1' }, 'mycontainer; rm -rf /', '100; evil_command');

  // tail must be parsed to 100, not evil_command
  assert.ok(executedCmd.includes('--tail 100'), `Command should contain '--tail 100', got: ${executedCmd}`);
  assert.ok(!executedCmd.includes('evil_command'), `Command should not contain injected evil_command`);
  assert.ok(executedCmd.includes("'mycontainer; rm -rf /'"), `ContainerId must be single-quoted`);
});

test('Security: DiagnoseService sanitizes ports and disk target against injection', async () => {
  let executedCmd = '';
  const mockSsh = {
    exec: async (_profile, cmd) => {
      executedCmd = cmd;
      return { code: 0, stdout: '', stderr: '' };
    }
  };

  const diag = new DiagnoseService(mockSsh);
  // Ports injection attempt
  await diag.diagnose({ id: 'p1', host: 'localhost' }, 'ports', '8080; reboot');
  assert.ok(!executedCmd.includes('reboot'), 'Ports command must strip non-digit characters');
  assert.ok(executedCmd.includes(":8080 '"));

  // Disk injection attempt with command substitution
  await diag.diagnose({ id: 'p1', host: 'localhost' }, 'disk', '/var/$(whoami)');
  assert.ok(executedCmd.includes("'/var/$(whoami)'"), 'Disk path must be single-quoted to prevent $() substitution');
});

test('Security: RemoteFsService quotes mkdir and remove paths with single quotes', async () => {
  const executedCmds = [];
  const mockSsh = {
    exec: async (_profile, cmd) => {
      executedCmds.push(cmd);
      return { code: 0, stdout: '', stderr: '' };
    }
  };

  const rfs = new RemoteFsService(mockSsh);
  await rfs.mkdir({ id: 'p1' }, '/path/with spaces/$VAR');
  await rfs.remove({ id: 'p1' }, '/path/with/$()', true);

  assert.equal(executedCmds[0], "mkdir -p '/path/with spaces/$VAR'");
  assert.equal(executedCmds[1], "rm -rf '/path/with/$()'");
});
