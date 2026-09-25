import test from 'node:test';
import assert from 'node:assert/strict';
import { SshService } from '../lib/ssh-service.js';
import { apply } from '../lib/index.js';

test('sweepIdle closes only unused connections', () => {
  const service = new SshService({});
  service.idleTimeoutMs = 1000;
  const ended = [];
  const fake = (id) => ({ end() { ended.push(id); } });
  service.connections.set('old', fake('old'));
  service.connMeta.set('old', { lastUsed: 0, inFlight: 0, pinned: false });
  service.connections.set('busy', fake('busy'));
  service.connMeta.set('busy', { lastUsed: 0, inFlight: 1, pinned: false });
  service.connections.set('held', fake('held'));
  service.connMeta.set('held', { lastUsed: 0, inFlight: 0, pinned: true });
  service.connections.set('fresh', fake('fresh'));
  service.connMeta.set('fresh', { lastUsed: 4500, inFlight: 0, pinned: false });
  assert.deepEqual(service.sweepIdle(5000), ['old']);
  assert.deepEqual(ended, ['old']);
  assert.equal(service.connections.has('busy'), true);
  assert.equal(service.connections.has('held'), true);
  assert.equal(service.connections.has('fresh'), true);
});

test('idleTimer lifecycle [Issue #74]: apply creates interval, dispose clears it, reload leaves one timer', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });

  function createMockCtx() {
    const disposeHandlers = [];
    const mockCtx = {
      inject(deps, cb) {
        if (deps.includes('settings')) {
          cb({
            settings: { register: () => ({ get: () => ({ profiles: [] }), replace: async () => {} }) },
            effect: (fn) => fn()
          });
        }
        if (deps.includes('webServer')) {
          cb({
            webServer: { register: () => () => {} },
            connection: { requestRejection: () => undefined },
            effect: (fn) => fn()
          });
        }
      },
      provide() {},
      on(event, handler) {
        if (event === 'dispose') disposeHandlers.push(handler);
      },
      tools: { register() {} },
      logger: { warn() {}, info() {}, error() {}, debug() {} },
      dispose() {
        for (const h of disposeHandlers) h();
      }
    };
    return mockCtx;
  }

  // 1. apply creates one interval
  let sweepCalls = 0;
  const origSweep = SshService.prototype.sweepIdle;
  SshService.prototype.sweepIdle = function() {
    sweepCalls += 1;
    return origSweep.apply(this, arguments);
  };

  try {
    const ctx1 = createMockCtx();
    apply(ctx1, { profiles: [] });

    // Tick forward 60 seconds: sweepIdle should be called once
    t.mock.timers.tick(60_000);
    assert.equal(sweepCalls, 1, 'sweepIdle must be called on interval');

    // 2. dispose calls clearInterval and sweepIdle stops running
    ctx1.dispose();
    t.mock.timers.tick(60_000);
    assert.equal(sweepCalls, 1, 'sweepIdle must not run after dispose');

    // 3. apply -> dispose -> apply leaves exactly one active timer
    sweepCalls = 0;
    const ctx2 = createMockCtx();
    apply(ctx2, { profiles: [] });
    t.mock.timers.tick(60_000);
    assert.equal(sweepCalls, 1, 'second apply runs timer');

    ctx2.dispose();
    t.mock.timers.tick(60_000);
    assert.equal(sweepCalls, 1, 'timer stopped after second dispose');

    const ctx3 = createMockCtx();
    apply(ctx3, { profiles: [] });
    t.mock.timers.tick(60_000);
    assert.equal(sweepCalls, 2, 'third apply starts fresh timer');

    ctx3.dispose();
    t.mock.timers.tick(60_000);
    assert.equal(sweepCalls, 2, 'final dispose stops timer completely');
  } finally {
    SshService.prototype.sweepIdle = origSweep;
  }
});
