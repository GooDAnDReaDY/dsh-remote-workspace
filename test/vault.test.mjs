import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { VaultService } from '../lib/vault-service.js';

test('VaultService: isolated .env storage and hydration', () => {
  const tmpEnv = path.join(os.tmpdir(), `test-vault-${Date.now()}.env`);
  const vault = new VaultService(tmpEnv);

  try {
    assert.equal(fs.existsSync(tmpEnv), true);

    // 1. Set secrets for a profile
    vault.setProfileSecrets('srv-prod', {
      password: 'secretPassword123!',
      passphrase: 'keyPassphrase456'
    });

    const sec1 = vault.getProfileSecrets('srv-prod');
    assert.equal(sec1.password, 'secretPassword123!');
    assert.equal(sec1.passphrase, 'keyPassphrase456');
    assert.equal(sec1.privateKey, '');

    // 2. Multiline private key storage
    const fakeKey = `-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAA\n-----END OPENSSH PRIVATE KEY-----`;
    vault.setProfileSecrets('srv-prod', {
      privateKey: fakeKey
    });

    const sec2 = vault.getProfileSecrets('srv-prod');
    assert.equal(sec2.privateKey, fakeKey);
    assert.equal(sec2.password, 'secretPassword123!');

    // 3. Hydrate profile
    const rawProfile = {
      id: 'srv-prod',
      host: '1.2.3.4',
      port: 22,
      username: 'root'
    };
    const hydrated = vault.hydrateProfile(rawProfile);
    assert.equal(hydrated.password, 'secretPassword123!');
    assert.equal(hydrated.privateKey, fakeKey);

    // 4. Sanitize profile (for UI / DSH Config)
    const sanitized = vault.sanitizeProfile(rawProfile);
    assert.equal(sanitized.password, '••••••••');
    assert.equal(sanitized.hasStoredPassword, true);
    assert.equal(sanitized.hasStoredPrivateKey, true);

    // 5. Delete profile secrets
    vault.deleteProfileSecrets('srv-prod');
    const sec3 = vault.getProfileSecrets('srv-prod');
    assert.equal(sec3.password, '');
    assert.equal(sec3.privateKey, '');
  } finally {
    try { fs.unlinkSync(tmpEnv); } catch (_) {}
  }
});
