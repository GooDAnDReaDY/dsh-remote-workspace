import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('Client: registers with __ModuleLoader__ and defines proper slots via whileServed', () => {
  let loadedModule = null;
  const mockWindow = {
    __ModuleLoader__: {
      load(entry) {
        loadedModule = entry;
      }
    }
  };

  const clientCode = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');

  const context = vm.createContext({
    window: mockWindow,
    document: {
      getElementById: () => null,
      createElement: () => ({ setAttribute() {}, dataset: {} }),
      head: { appendChild() {} }
    },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }),
    confirm: () => true
  });

  vm.runInContext(clientCode, context);

  assert.ok(loadedModule, 'Expected __ModuleLoader__.load to be called');
  assert.equal(loadedModule.id, '@goodandready/dsh-remote-workspace');

  // Test factory
  const mockRequire = (mod) => {
    if (mod === 'react') {
      return {
        createElement: (type, props, ...children) => ({ type, props, children }),
        useState: (init) => [init, () => {}],
        useEffect: (fn) => fn(),
        Fragment: 'Fragment'
      };
    }
    throw new Error(`Unexpected require: ${mod}`);
  };

  const exportsObj = loadedModule.factory(mockRequire);
  assert.ok(typeof exportsObj.apply === 'function');
  assert.ok(exportsObj.inject.includes('slots'));
  assert.ok(exportsObj.inject.includes('locale'));
  assert.ok(exportsObj.inject.includes('configForms'));

  // Test apply(ctx) with configForms and whileServed
  const registeredSlots = [];
  const injectedSlotNames = [];
  let whileServedCalled = false;

  const mockCtx = {
    locale: { register() {} },
    inject(deps, callback) {
      if (deps.includes('configForms')) {
        callback(this);
      }
    },
    effect(fn) {
      return fn();
    },
    configForms: {
      get(ns) {
        assert.equal(ns, 'dsh-remote-workspace');
        return { status: 'ready' };
      },
      whileServed(namespaces, callback) {
        whileServedCalled = true;
        assert.equal(namespaces && namespaces[0], 'dsh-remote-workspace');
        return callback();
      }
    },
    slots: {
      inject(slotName, callback) {
        injectedSlotNames.push(slotName);
        callback();
      },
      register(options, component) {
        registeredSlots.push({ options, component });
      }
    }
  };

  exportsObj.apply(mockCtx);

  assert.ok(whileServedCalled, 'whileServed should be called for dsh-remote-workspace');
  assert.ok(injectedSlotNames.includes('plugins.item'));
  assert.ok(injectedSlotNames.includes('plugins.row.config'));
  assert.ok(injectedSlotNames.includes('conversation.session.header.utilities'));

  // settings.plugin.item must NOT be registered (retired in DSH 0.2.0-rc.1)
  assert.ok(!injectedSlotNames.includes('settings.plugin.item'), 'settings.plugin.item must be retired');
  assert.ok(!registeredSlots.some((s) => s.options.name === 'settings.plugin.item'), 'Forbidden settings.plugin.item must not be present');
});

test('Client: apply registers locale via ctx.effect and supports repeated apply', () => {
  let loadedModule = null;
  const mockWindow = {
    __ModuleLoader__: {
      load(entry) {
        loadedModule = entry;
      }
    }
  };

  const clientCode = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
  const context = vm.createContext({
    window: mockWindow,
    document: {
      getElementById: () => null,
      createElement: () => ({ setAttribute() {}, dataset: {} }),
      head: { appendChild() {} }
    },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }),
    confirm: () => true
  });
  vm.runInContext(clientCode, context);

  const mockRequire = (mod) => ({
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (init) => [init, () => {}],
    useEffect: (fn) => fn(),
    Fragment: 'Fragment'
  });

  const exportsObj = loadedModule.factory(mockRequire);
  let effectCalled = false;
  let registerCount = 0;

  const mockCtx = {
    locale: {
      register(ns, dicts) {
        registerCount++;
        return () => {};
      }
    },
    effect(fn, label) {
      effectCalled = true;
      assert.equal(label, 'dsh-remote-workspace: dictionaries');
      return fn();
    },
    slots: {
      inject(slotName, cb) { cb(); },
      register() {}
    }
  };

  exportsObj.apply(mockCtx);
  assert.ok(effectCalled, 'ctx.effect should be called');
  assert.equal(registerCount, 1);

  // Repeated apply simulation (HMR)
  exportsObj.apply(mockCtx);
  assert.equal(registerCount, 2);
});
