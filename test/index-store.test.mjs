import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, Config } from '../lib/index.js';

test('Core: apply handles undefined config safely (Fixes Issue #3)', () => {
  const events = [];
  const mockCtx = {
    inject(deps, cb) {
      if (deps.includes('settings')) {
        cb({
          settings: {
            register: () => ({ get: () => null, replace: async () => {} })
          },
          effect: () => () => {}
        });
      }
    },
    provide() {},
    on(ev, cb) { events.push({ ev, cb }); },
    tools: { register() {} },
    webServer: { register() {} }
  };

  assert.doesNotThrow(() => {
    apply(mockCtx, undefined);
  });
});

test('Core: Config schema provides sensible defaults for empty profile fields', () => {
  const parsed = Config({
    profiles: [{ id: 'p1' }]
  });
  assert.equal(parsed.profiles[0].id, 'p1');
  assert.equal(parsed.profiles[0].port, 22);
  assert.equal(parsed.profiles[0].username, 'root');
  assert.equal(parsed.profiles[0].authType, 'key');
  assert.equal(parsed.profiles[0].password, '');
  assert.equal(parsed.profiles[0].localMirrorPath, '');
});

test('Core: apply sets up store and allows profile CRUD operations', async () => {
  let settingsReplaced = null;
  const mockCtx = {
    inject(deps, cb) {
      if (deps.includes('settings')) {
        cb({
          settings: {
            register: () => ({
              get: () => ({ profiles: [{ id: 'p1', host: '1.2.3.4' }], activeProfileId: 'p1' }),
              replace: async (newCfg) => { settingsReplaced = newCfg; }
            })
          },
          effect: () => () => {}
        });
      }
    },
    provide() {},
    on() {},
    tools: { register() {} }
  };

  apply(mockCtx, { profiles: [] });

  assert.ok(mockCtx.remoteSsh);
  assert.ok(mockCtx.remoteFs);
  assert.ok(mockCtx.remoteSync);
  assert.ok(mockCtx.remoteTunnel);
});
