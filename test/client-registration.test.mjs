import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

test('Client: registers with __ModuleLoader__ and defines proper slots', () => {
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

  // Test apply(ctx)
  const registeredSlots = [];
  const injectedSlotNames = [];
  const mockCtx = {
    locale: { register() {} },
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

  // settings.plugin.item must be injected
  assert.ok(injectedSlotNames.includes('settings.plugin.item'));
  const pluginItemSlot = registeredSlots.find((s) => s.options.name === 'settings.plugin.item');
  assert.ok(pluginItemSlot, 'settings.plugin.item slot registered');
  assert.equal(pluginItemSlot.options.key, 'dsh-remote-workspace');

  // conversation utility chip must be injected
  assert.ok(injectedSlotNames.includes('conversation.session.header.utilities'));

  // settings.section must NEVER be registered
  assert.ok(!injectedSlotNames.includes('settings.section'), 'settings.section must not be registered');
  assert.ok(!registeredSlots.some((s) => s.options.name === 'settings.section'), 'Forbidden settings.section must not be present');
});
