import test from 'node:test';
import assert from 'node:assert/strict';
import { SshConfigParser } from '../lib/ssh-config-parser.js';
import { EnvService } from '../lib/env-service.js';
import { DiagnoseService } from '../lib/diagnose-service.js';
import { AlertService } from '../lib/alert-service.js';
import { TarSyncService } from '../lib/tar-sync-service.js';

test('SshConfigParser: parses standard SSH config blocks properly', () => {
  const sampleConfig = `
# Global comment
Host bastion
    HostName bastion.example.com
    User admin
    Port 2222
    IdentityFile ~/.ssh/bastion_key

Host prod-app
    HostName 10.0.1.5
    User deploy
    ProxyJump bastion
    IdentityFile ~/.ssh/prod_key
`;

  const profiles = SshConfigParser.parse(sampleConfig);
  assert.equal(profiles.length, 2);

  const bastion = profiles.find((p) => p.name === 'bastion');
  assert.ok(bastion);
  assert.equal(bastion.host, 'bastion.example.com');
  assert.equal(bastion.username, 'admin');
  assert.equal(bastion.port, 2222);
  assert.equal(bastion.privateKey, '~/.ssh/bastion_key');

  const prodApp = profiles.find((p) => p.name === 'prod-app');
  assert.ok(prodApp);
  assert.equal(prodApp.host, '10.0.1.5');
  assert.equal(prodApp.username, 'deploy');
  assert.equal(prodApp.jumpHostId, 'bastion');
});

test('EnvService: parseEnv preserves comments and correctly parses key-values', () => {
  const envContent = `
# Database settings
DB_HOST=127.0.0.1
DB_PORT=5432

# Secrets
JWT_SECRET="super secret phrase"
APP_DEBUG=true
`;

  const service = new EnvService({});
  const entries = service.parseEnv(envContent);

  const dbHost = entries.find((e) => e.key === 'DB_HOST');
  assert.ok(dbHost);
  assert.equal(dbHost.value, '127.0.0.1');

  const jwt = entries.find((e) => e.key === 'JWT_SECRET');
  assert.ok(jwt);
  assert.equal(jwt.value, 'super secret phrase');
  assert.equal(jwt.isQuoted, true);

  const comments = entries.filter((e) => e.type === 'comment');
  assert.equal(comments.length, 2);
});

test('EnvService: setEnvVar updates existing key and quotes if necessary', async () => {
  let fileStore = `PORT=3000\nAPI_KEY=oldkey\n`;
  const mockFs = {
    async readFile() { return fileStore; },
    async writeFile(_p, _f, content) { fileStore = content; return { ok: true }; }
  };

  const service = new EnvService(mockFs);
  await service.setEnvVar({}, '.env', 'API_KEY', 'newkey_with spaces');

  assert.ok(fileStore.includes('API_KEY="newkey_with spaces"'));
  assert.ok(fileStore.includes('PORT=3000'));
});

test('DiagnoseService: builds correct command and executes via sshService', async () => {
  let executedCmd = '';
  const mockSsh = {
    async exec(_p, cmd) {
      executedCmd = cmd;
      return { code: 0, stdout: 'ss -tulpn output...' };
    }
  };

  const service = new DiagnoseService(mockSsh);
  const res = await service.diagnose({ host: '127.0.0.1' }, 'ports', '8080');

  assert.equal(res.ok, true);
  assert.ok(executedCmd.includes(':8080'));
  assert.ok(executedCmd.includes('ss -tulpn'));
});

test('AlertService: identifies critical disk and memory conditions', async () => {
  const mockHealth = {
    async getHealth() {
      return {
        disk: { percent: 94 },
        memory: { percent: 96 }
      };
    }
  };

  const emitted = [];
  const mockCtx = {
    emit(event, payload) { emitted.push({ event, payload }); }
  };

  const service = new AlertService(mockCtx, mockHealth, null);
  const alerts = await service.check({ name: 'server-1', host: '1.2.3.4' });

  assert.equal(alerts.length, 2);
  assert.ok(alerts.some((a) => a.type === 'disk_full'));
  assert.ok(alerts.some((a) => a.type === 'memory_high'));
  assert.equal(emitted.length, 2);
});
