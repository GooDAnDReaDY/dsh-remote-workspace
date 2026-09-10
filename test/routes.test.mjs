import test from 'node:test';
import assert from 'node:assert/strict';
import { registerApiRoutes } from '../lib/routes.js';

function createMockReq(method, path, body = null, headers = {}) {
  const listeners = {};
  const req = {
    method,
    url: path,
    headers: { 'sec-fetch-site': 'same-origin', ...headers },
    on(event, cb) {
      listeners[event] = cb;
      if (event === 'end') {
        process.nextTick(() => {
          if (body !== null) {
            const str = typeof body === 'string' ? body : JSON.stringify(body);
            if (listeners['data']) listeners['data'](Buffer.from(str));
          }
          cb();
        });
      }
    },
    destroy() {}
  };
  return req;
}

function createMockRes() {
  let statusCode = 200;
  let headers = {};
  let body = '';
  return {
    writeHead(code, h) {
      statusCode = code;
      headers = h;
    },
    end(data) {
      if (data) body += data;
    },
    getStatusCode() { return statusCode; },
    getHeaders() { return headers; },
    getBody() { return body ? JSON.parse(body) : null; }
  };
}

function setupTestRoutes() {
  const registered = new Map();
  const mockWebServer = {
    register({ path, handler }) {
      registered.set(path, handler);
    }
  };

  const mockCtx = {
    inject(deps, cb) {
      cb({
        webServer: mockWebServer,
        get(key) { return key === 'webServer' ? mockWebServer : null; },
        effect(fn) { fn(); }
      });
    }
  };

  const storeProfiles = [
    { id: 'p1', name: 'Server 1', host: '10.0.0.1', port: 22, username: 'root', remoteWorkspace: '/remote', localMirrorPath: '/local' }
  ];
  let activeId = 'p1';

  const mockStore = {
    getProfiles: () => storeProfiles,
    getProfile: (id) => storeProfiles.find((p) => p.id === id),
    getActiveId: () => activeId,
    getActiveProfile: () => storeProfiles.find((p) => p.id === activeId),
    saveProfile: async (p) => {
      const idx = storeProfiles.findIndex((x) => x.id === p.id);
      if (idx >= 0) storeProfiles[idx] = p;
      else storeProfiles.push(p);
    },
    deleteProfile: async (id) => {
      const idx = storeProfiles.findIndex((x) => x.id === id);
      if (idx >= 0) storeProfiles.splice(idx, 1);
    },
    setActiveId: async (id) => { activeId = id; }
  };

  const mockSsh = {
    invalidate: () => {},
    disconnect: () => {},
    testConnection: async () => ({ success: true, latency: 12, os: 'Linux 6.8' })
  };

  const mockFs = {
    listDir: async () => [{ filename: 'src', isDirectory: true, isFile: false }]
  };

  const mockSync = {
    pull: async () => ({ success: true, pulled: ['index.js'], conflicts: [] }),
    push: async () => ({ success: true, pushed: ['index.js'], conflicts: [] })
  };

  const mockTunnel = {
    listActiveTunnels: () => [{ id: 'tun1', profileId: 'p1', localPort: 8080, remotePort: 80 }],
    startLocalTunnel: async (_p, localPort, targetHost, remotePort) => ({ success: true, tunnelId: 'tun2', localPort, targetHost, remotePort }),
    stopTunnel: (_id) => true
  };

  registerApiRoutes(mockCtx, mockSsh, mockFs, mockSync, mockTunnel, mockStore);

  return { registered, mockStore, mockSsh, mockFs, mockSync, mockTunnel };
}

test('API Routes: GET /dsh-remote-workspace/state returns profiles and activeId', async () => {
  const { registered } = setupTestRoutes();
  const handler = registered.get('/dsh-remote-workspace/state');
  assert.ok(handler, 'Route /state should be registered');

  const req = createMockReq('GET', '/dsh-remote-workspace/state');
  const res = createMockRes();
  await handler(req, res);

  assert.equal(res.getStatusCode(), 200);
  const data = res.getBody();
  assert.equal(data.ok, true);
  assert.equal(data.profiles.length, 1);
  assert.equal(data.activeId, 'p1');
  assert.equal(data.tunnels.length, 1);
});

test('API Routes: rejects cross-site requests on mutating endpoints', async () => {
  const { registered } = setupTestRoutes();
  const handler = registered.get('/dsh-remote-workspace/profiles/save');
  const req = createMockReq('POST', '/dsh-remote-workspace/profiles/save', { id: 'p2', host: '10.0.0.2' }, { 'sec-fetch-site': 'cross-site' });
  const res = createMockRes();
  await handler(req, res);

  assert.equal(res.getStatusCode(), 403);
  assert.equal(res.getBody().error, 'Forbidden');
});

test('API Routes: POST /dsh-remote-workspace/profiles/save saves and validates', async () => {
  const { registered, mockStore } = setupTestRoutes();
  const handler = registered.get('/dsh-remote-workspace/profiles/save');

  // Missing host validation error
  const badReq = createMockReq('POST', '/dsh-remote-workspace/profiles/save', { id: 'p2' });
  const badRes = createMockRes();
  await handler(badReq, badRes);
  assert.equal(badRes.getStatusCode(), 400);

  // Success save
  const req = createMockReq('POST', '/dsh-remote-workspace/profiles/save', { id: 'p2', host: '10.0.0.2', name: 'Server 2' });
  const res = createMockRes();
  await handler(req, res);
  assert.equal(res.getStatusCode(), 200);
  assert.equal(mockStore.getProfiles().length, 2);
});

test('API Routes: POST /dsh-remote-workspace/test returns normalized latencyMs and remoteOs', async () => {
  const { registered } = setupTestRoutes();
  const handler = registered.get('/dsh-remote-workspace/test');

  const req = createMockReq('POST', '/dsh-remote-workspace/test', { host: '10.0.0.1' });
  const res = createMockRes();
  await handler(req, res);

  assert.equal(res.getStatusCode(), 200);
  const data = res.getBody();
  assert.equal(data.ok, true);
  assert.equal(data.latencyMs, 12);
  assert.equal(data.remoteOs, 'Linux 6.8');
});

test('API Routes: POST /dsh-remote-workspace/tunnels/start and stop manage tunnels', async () => {
  const { registered } = setupTestRoutes();
  const startHandler = registered.get('/dsh-remote-workspace/tunnels/start');
  const stopHandler = registered.get('/dsh-remote-workspace/tunnels/stop');

  const startReq = createMockReq('POST', '/dsh-remote-workspace/tunnels/start', { profileId: 'p1', localPort: 9000, remotePort: 3000 });
  const startRes = createMockRes();
  await startHandler(startReq, startRes);
  assert.equal(startRes.getStatusCode(), 200);
  assert.equal(startRes.getBody().tunnelId, 'tun2');

  const stopReq = createMockReq('POST', '/dsh-remote-workspace/tunnels/stop', { tunnelId: 'tun2' });
  const stopRes = createMockRes();
  await stopHandler(stopReq, stopRes);
  assert.equal(stopRes.getStatusCode(), 200);
  assert.equal(stopRes.getBody().ok, true);
});
