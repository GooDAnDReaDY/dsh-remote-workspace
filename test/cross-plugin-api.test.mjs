import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../lib/index.js';
import { SshService } from '../lib/ssh-service.js';

test('SshService: execById throws if profile not found or resolver not set', async () => {
  const ssh = new SshService();
  await assert.rejects(
    async () => { await ssh.execById('nonexistent', 'ls'); },
    /Profile resolver not configured/
  );

  ssh.setProfileResolver((id) => id === 'known' ? { id: 'known', host: 'localhost' } : null);

  await assert.rejects(
    async () => { await ssh.execById('unknown', 'ls'); },
    /Remote profile "unknown" not found/
  );
});

test('Cross-plugin API: ctx.remoteProfiles exposes safe list without secrets and get(id)', () => {
  const mockCtx = {
    inject() {},
    provide() {},
    on() {},
    tools: { register() {} }
  };

  const initialConfig = {
    profiles: [
      {
        id: 'srv1',
        name: 'Production VPS',
        host: '10.0.0.1',
        port: 2222,
        username: 'deploy',
        authType: 'key',
        password: 'SUPER_SECRET_PASSWORD',
        privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----...'
      }
    ],
    activeProfileId: 'srv1'
  };

  apply(mockCtx, initialConfig);

  assert.ok(mockCtx.remoteProfiles, 'ctx.remoteProfiles must be exported');
  assert.equal(typeof mockCtx.remoteProfiles.list, 'function');
  assert.equal(typeof mockCtx.remoteProfiles.get, 'function');

  const list = mockCtx.remoteProfiles.list();
  assert.equal(list.length, 1);
  const item = list[0];
  assert.equal(item.id, 'srv1');
  assert.equal(item.name, 'Production VPS');
  assert.equal(item.host, '10.0.0.1');
  assert.equal(item.port, 2222);
  assert.equal(item.username, 'deploy');

  // Secrets MUST NOT be exposed in list()
  assert.equal(item.password, undefined);
  assert.equal(item.privateKey, undefined);
  assert.equal(item.passphrase, undefined);

  // get(id) returns the profile
  const profile = mockCtx.remoteProfiles.get('srv1');
  assert.ok(profile);
  assert.equal(profile.id, 'srv1');

  // execById is available on remoteSsh
  assert.equal(typeof mockCtx.remoteSsh.execById, 'function');
});
