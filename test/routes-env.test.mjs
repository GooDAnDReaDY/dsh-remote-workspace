import test from 'node:test';
import assert from 'node:assert/strict';
import { registerEnvRoutes } from '../lib/routes/env.js';

function createMockRes() {
  return {
    statusCode: null,
    headers: {},
    body: '',
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(code, h) { this.statusCode = code; if (h) Object.assign(this.headers, h); },
    end(data) { this.body = data; }
  };
}

function createMockReq(method, path, body) {
  const jsonBody = JSON.stringify(body || {});
  const listeners = {};
  return {
    method,
    url: path,
    headers: {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(jsonBody)),
      'sec-fetch-site': 'same-origin',
      'host': 'localhost:3000',
      'origin': 'http://localhost:3000'
    },
    socket: { remoteAddress: '127.0.0.1' },
    on(event, fn) {
      listeners[event] = fn;
      if (event === 'data') setTimeout(() => { fn(Buffer.from(jsonBody)); listeners['end']?.(); }, 1);
    }
  };
}

test('Env Routes: /env/view reads remote env file using envService.readEnv', async () => {
  const routes = new Map();
  const mockProfile = { id: 'p1', host: '192.168.1.50', remoteWorkspace: '/workspace' };
  let readEnvCalled = false;

  const mockEnvService = {
    async readEnv(profile, filePath) {
      readEnvCalled = true;
      assert.equal(profile.id, 'p1');
      assert.equal(filePath, '/workspace/.env');
      return { filePath, entries: [{ type: 'var', key: 'PORT', value: '3000' }] };
    }
  };

  const mockStore = {
    getProfile: (id) => id === 'p1' ? mockProfile : null
  };

  const mockServer = {
    register: (opts) => { routes.set(opts.path, opts.handler); }
  };

  const sctx = {
    effect: (fn) => fn(),
    reflect: { get: () => ({ requestRejection: () => undefined }) }
  };

  registerEnvRoutes(sctx, mockServer, { envService: mockEnvService, store: mockStore });

  const handler = routes.get('/dsh-remote-workspace/env/view');
  assert.ok(handler);

  const req = createMockReq('POST', '/dsh-remote-workspace/env/view', { profileId: 'p1' });
  const res = createMockRes();

  await handler(req, res);
  assert.ok(readEnvCalled, 'readEnv must be called');
  assert.equal(res.statusCode, 200);
  const json = JSON.parse(res.body);
  assert.equal(json.ok, true);
  assert.equal(json.entries[0].key, 'PORT');
});

test('Env Routes: /env/save updates env variable or content atomically', async () => {
  const routes = new Map();
  const mockProfile = { id: 'p1', host: '192.168.1.50', remoteWorkspace: '/workspace' };
  let setVarCalled = false;

  const mockEnvService = {
    async setEnvVar(profile, filePath, key, val) {
      setVarCalled = true;
      assert.equal(key, 'FOO');
      assert.equal(val, 'BAR');
      return { ok: true, key, updated: true };
    }
  };

  const mockStore = {
    getProfile: (id) => id === 'p1' ? mockProfile : null
  };

  const mockServer = {
    register: (opts) => { routes.set(opts.path, opts.handler); }
  };

  const sctx = {
    effect: (fn) => fn(),
    reflect: { get: () => ({ requestRejection: () => undefined }) }
  };

  registerEnvRoutes(sctx, mockServer, { envService: mockEnvService, store: mockStore });

  const handler = routes.get('/dsh-remote-workspace/env/save');
  const req = createMockReq('POST', '/dsh-remote-workspace/env/save', { profileId: 'p1', key: 'FOO', value: 'BAR' });
  const res = createMockRes();

  await handler(req, res);
  assert.ok(setVarCalled);
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).ok, true);
});

test('Env Routes: /diagnose invokes diagnoseService.diagnose with profile as 1st argument', async () => {
  const routes = new Map();
  const mockProfile = { id: 'p1', host: '192.168.1.50' };
  let diagCalled = false;

  const mockDiagService = {
    async diagnose(profile, category, target) {
      diagCalled = true;
      assert.equal(profile.id, 'p1');
      assert.equal(category, 'ports');
      assert.equal(target, '8080');
      return { ok: true, category, output: 'LISTEN 8080' };
    }
  };

  const mockStore = {
    getProfile: (id) => id === 'p1' ? mockProfile : null
  };

  const mockServer = {
    register: (opts) => { routes.set(opts.path, opts.handler); }
  };

  const sctx = {
    effect: (fn) => fn(),
    reflect: { get: () => ({ requestRejection: () => undefined }) }
  };

  registerEnvRoutes(sctx, mockServer, { diagnoseService: mockDiagService, store: mockStore });

  const handler = routes.get('/dsh-remote-workspace/diagnose');
  const req = createMockReq('POST', '/dsh-remote-workspace/diagnose', { profileId: 'p1', category: 'ports', target: '8080' });
  const res = createMockRes();

  await handler(req, res);
  assert.ok(diagCalled);
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).output, 'LISTEN 8080');
});
