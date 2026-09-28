import test from 'node:test';
import assert from 'node:assert/strict';
import { Config } from '../lib/index.js';

test('Settings: Config exports volatile fields for DSH 0.2.0-rc.1 describe', () => {
  assert.ok(Config.dict, 'Config must be an object schema with dictionary');

  // Verify volatile fields
  const volatileFields = ['activeProfileId', 'autoSyncActive', 'alertMonitoringActive', 'terminalFontFamily', 'profiles'];
  for (const field of volatileFields) {
    const leaf = Config.dict[field];
    assert.ok(leaf, `Field ${field} must exist in Config`);
    assert.equal(leaf.meta?.volatile, true, `Field ${field} must be marked volatile`);
  }

  // Verify secrets are NOT exposed as top-level volatile fields
  assert.equal(Config.dict.password, undefined);
  assert.equal(Config.dict.privateKey, undefined);
  assert.equal(Config.dict.passphrase, undefined);
});
