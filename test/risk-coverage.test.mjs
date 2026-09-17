import test from 'node:test';
import assert from 'node:assert/strict';
import { SshService } from '../lib/ssh-service.js';
import { VaultService } from '../lib/vault-service.js';
import { HealthService } from '../lib/health-service.js';
import { DockerService } from '../lib/docker-service.js';
import { DiagnoseService } from '../lib/diagnose-service.js';
import { AlertService } from '../lib/alert-service.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

test('SshService: handles unreachable hosts gracefully with timeout/rejection', async () => {
  const ssh = new SshService();
  const badProfile = {
    id: 'bad-host',
    host: '127.0.0.1',
    port: 19999,
    username: 'nobody',
    authType: 'password',
    password: 'wrong'
  };

  await assert.rejects(
    async () => {
      await ssh.getConnection(badProfile);
    },
    (err) => {
      assert.ok(err instanceof Error);
      return true;
    }
  );
});

test('SshService: disconnect and invalidate methods do not throw for unknown profiles', () => {
  const ssh = new SshService();
  assert.doesNotThrow(() => ssh.disconnect('non-existent-profile'));
  assert.doesNotThrow(() => ssh.invalidate('non-existent-profile'));
});

test('VaultService: securely handles newlines, quotes and equals in secret values', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-test-'));
  const vaultPath = path.join(tmpDir, 'test.env');

  try {
    const vault = new VaultService(vaultPath);
    const complexKey = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----';
    const complexPass = 'p@ss=w"ord\nwith\nspecial\rchars';

    vault.setProfileSecrets('test_prof', {
      privateKey: complexKey,
      password: complexPass,
      passphrase: 'simple'
    });

    const readBack = vault.getProfileSecrets('test_prof');
    assert.equal(readBack.privateKey, complexKey);
    assert.equal(readBack.password, complexPass);
    assert.equal(readBack.passphrase, 'simple');

    // Test sanitization masks secrets
    const profile = { id: 'test_prof', name: 'Test', host: 'example.com' };
    const sanitized = vault.sanitizeProfile(profile);
    assert.equal(sanitized.password, '••••••••');
    assert.equal(sanitized.privateKey, '••••••••');
    assert.equal(sanitized.hasStoredPassword, true);
    assert.equal(sanitized.hasStoredPrivateKey, true);

    // Test hydration restores secrets
    const hydrated = vault.hydrateProfile(profile);
    assert.equal(hydrated.privateKey, complexKey);
    assert.equal(hydrated.password, complexPass);

    // Clean up
    vault.deleteProfileSecrets('test_prof');
    const emptySecrets = vault.getProfileSecrets('test_prof');
    assert.equal(emptySecrets.privateKey, '');
    assert.equal(emptySecrets.password, '');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('HealthService: safely handles empty or malformed command outputs', async () => {
  const mockSsh = {
    async exec(profile, cmd) {
      if (cmd.includes('uptime')) return { code: 0, stdout: 'malformed output', stderr: '' };
      return { code: 0, stdout: '', stderr: '' };
    }
  };
  const health = new HealthService(mockSsh);

  const res = await health.getHealth({ id: 'p1', host: 'localhost' });
  assert.ok(res);
  assert.equal(typeof res, 'object');
});

test('DockerService: handles docker command failures gracefully', async () => {
  const mockSsh = {
    async exec() {
      return { code: 127, stdout: '', stderr: 'docker: command not found' };
    }
  };
  const docker = new DockerService(mockSsh);

  const res = await docker.listContainers({ id: 'p1', host: 'localhost' }, true);
  assert.equal(res.available, false);
  assert.deepEqual(res.containers, []);
});

test('AlertService: respects active state and emits events', () => {
  const mockCtx = { emit() {} };
  const mockHealth = {};
  const mockDocker = {};
  const alerts = new AlertService(mockCtx, mockHealth, mockDocker);

  assert.equal(alerts.getAlerts().length, 0);

  alerts.start(60000);
  assert.equal(alerts.enabled, true);

  alerts.stop();
  assert.equal(alerts.enabled, false);
});

test('DiagnoseService: builds and executes diagnostic category commands', async () => {
  const executedCommands = [];
  const mockSsh = {
    async exec(profile, cmd) {
      executedCommands.push(cmd);
      return { code: 0, stdout: 'Filesystem 10G 2G 8G 20% /', stderr: '' };
    }
  };
  const diagnose = new DiagnoseService(mockSsh);

  const res = await diagnose.diagnose({ id: 'p1', host: 'localhost' }, 'disk');
  assert.equal(res.ok, true);
  assert.ok(executedCommands[0].includes('df -h'));
});
