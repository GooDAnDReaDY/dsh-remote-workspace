import test from 'node:test';
import assert from 'node:assert/strict';
import { registerApiRoutes } from '../lib/routes.js';

function createMockReq(method, path, body = null, headers = {}, remoteAddress = '127.0.0.1') {
  const listeners = {};
  const req = {
    method,
    url: path,
    headers: { 'sec-fetch-site': 'same-origin', ...headers },
    socket: { remoteAddress },
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

function setupTestRoutes(options = {}) {
  const registered = new Map();
  const mockWebServer = {
    register({ path, handler }) {
      registered.set(path, handler);
    }
  };

  const defaultConnection = {
    requestRejection(req) {
      if (req._rejection !== undefined) return req._rejection;
      const ip = req?.socket?.remoteAddress || '127.0.0.1';
      const isLoopback = ip === '127.0.0.1' || ip === '::1' || (typeof ip === 'string' && ip.startsWith('127.'));
      const expectedToken = process.env.DSH_AUTH_TOKEN || process.env.DSH_TOKEN;
      const rawAuth = req?.headers?.['authorization'];
      const hasValidToken = expectedToken && typeof rawAuth === 'string' && rawAuth === `Bearer ${expectedToken}`;
      if (!isLoopback && !hasValidToken) {
        return 403;
      }
      if (req?.headers?.['sec-fetch-site'] === 'cross-site') return 403;
      const origin = req?.headers?.['origin'];
      const host = req?.headers?.['host'];
      if (origin && host) {
        try {
          if (new URL(origin).host !== host) return 403;
        } catch {
          return 403;
        }
      }
      return undefined;
    }
  };

  const connectionService = options.connection !== undefined ? options.connection : defaultConnection;

  const mockCtx = {
    inject(deps, cb) {
      const sctx = {
        webServer: mockWebServer,
        connection: connectionService,
        reflect: {
          get(key) {
            if (key === 'webServer') return mockWebServer;
            if (key === 'connection') return connectionService;
            return null;
          }
        },
        get(key) {
          if (key === 'webServer') return mockWebServer;
          if (key === 'connection') return connectionService;
          return null;
        },
        effect(fn) { fn(); }
      };
      cb(sctx);
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

  let lastTerminalOptions = null;
  let clusterExecuted = 0;
  let terminalInputSent = 0;
  let fileSaved = 0;
  let envSaved = 0;
  let dockerActionCount = 0;

  const mockSsh = {
    invalidate: () => {},
    disconnect: () => {},
    testConnection: async () => ({ success: true, latency: 12, os: 'Linux 6.8' }),
    createTerminalSession: async (profile, options) => {
      lastTerminalOptions = options;
      return { id: 'term_mock_1', profileId: profile.id };
    },
    exec: async () => {
      clusterExecuted += 1;
      return { stdout: '', stderr: '', code: 0 };
    },
    executeCluster: async () => {
      clusterExecuted += 1;
      return [];
    },
    sendTerminalInput: async () => {
      terminalInputSent += 1;
      return true;
    }
  };

  const mockFs = {
    listDir: async () => [{ filename: 'src', isDirectory: true, isFile: false }],
    stat: async () => ({ isFile: true, size: 100 }),
    readFile: async () => Buffer.from('hello'),
    writeFile: async () => {
      fileSaved += 1;
    }
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

  const mockDocker = {
    executeAction: async () => {
      dockerActionCount += 1;
      return { success: true };
    },
    listContainers: async () => [],
    getLogs: async () => ''
  };

  const mockHealth = {
    getHealth: async () => ({ ok: true })
  };

  const mockWatcher = {
    toggle: async () => ({ active: true }),
    getStatus: () => ({ active: false })
  };

  const mockDiagnose = {
    runDiagnose: async () => ({ ok: true })
  };

  const mockEnv = {
    getRemoteEnv: async () => ({ content: '' }),
    saveRemoteEnv: async () => {
      envSaved += 1;
      return { success: true };
    }
  };

  const mockTarSync = {};
  const mockAlert = {
    getStatus: () => ({ active: false }),
    getAlerts: () => []
  };

  registerApiRoutes(
    mockCtx,
    mockSsh,
    mockFs,
    mockSync,
    mockTunnel,
    mockStore,
    mockDocker,
    mockHealth,
    mockWatcher,
    mockDiagnose,
    mockEnv,
    mockTarSync,
    mockAlert
  );

  return {
    registered,
    mockStore,
    mockSsh,
    mockFs,
    mockSync,
    mockTunnel,
    mockDocker,
    mockEnv,
    getLastTerminalOptions: () => lastTerminalOptions,
    getCounters: () => ({ clusterExecuted, terminalInputSent, fileSaved, envSaved, dockerActionCount })
  };
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

test('API Routes: POST /dsh-remote-workspace/browse calls listDir and returns entries and items', async () => {
  const { registered } = setupTestRoutes();
  const handler = registered.get('/dsh-remote-workspace/browse');
  assert.ok(handler, 'Route /browse should be registered');

  // Case 1: with profileId
  const req1 = createMockReq('POST', '/dsh-remote-workspace/browse', { profileId: 'p1', remotePath: '/remote/src' });
  const res1 = createMockRes();
  await handler(req1, res1);

  assert.equal(res1.getStatusCode(), 200);
  const data1 = res1.getBody();
  assert.equal(data1.ok, true);
  assert.ok(Array.isArray(data1.entries));
  assert.equal(data1.entries.length, 1);
  assert.equal(data1.entries[0].filename, 'src');
  assert.equal(data1.items.length, 1);
  assert.equal(data1.currentPath, '/remote/src');

  // Case 2: with inline profile object from settings editor
  const req2 = createMockReq('POST', '/dsh-remote-workspace/browse', {
    profile: { id: 'custom-temp', host: '192.168.1.50' },
    remotePath: '/var/www'
  });
  const res2 = createMockRes();
  await handler(req2, res2);

  assert.equal(res2.getStatusCode(), 200);
  const data2 = res2.getBody();
  assert.equal(data2.ok, true);
  assert.ok(Array.isArray(data2.entries));

  // Case 3: profile not found
  const req3 = createMockReq('POST', '/dsh-remote-workspace/browse', { profileId: 'nonexistent' });
  const res3 = createMockRes();
  await handler(req3, res3);
  assert.equal(res3.getStatusCode(), 404);
});

test('API Routes: POST /dsh-remote-workspace/terminal/create passes options object', async () => {
  const { registered, getLastTerminalOptions } = setupTestRoutes();
  const handler = registered.get('/dsh-remote-workspace/terminal/create');
  assert.ok(handler, 'Route /terminal/create should be registered');

  const req = createMockReq('POST', '/dsh-remote-workspace/terminal/create', { profileId: 'p1', cols: 100, rows: 35 });
  const res = createMockRes();
  await handler(req, res);

  assert.equal(res.getStatusCode(), 200);
  const data = res.getBody();
  assert.equal(data.ok, true);
  assert.equal(data.sessionId, 'term_mock_1');
  const passedOpts = getLastTerminalOptions();
  assert.deepEqual(passedOpts, { cols: 100, rows: 35 });
});

test('API Routes [Issue #25]: rejects cross-site requests even when originating from loopback IP', async () => {
  const { registered } = setupTestRoutes();
  const handler = registered.get('/dsh-remote-workspace/profiles/save');

  // Case 1: Loopback IP with sec-fetch-site: cross-site
  const req1 = createMockReq('POST', '/dsh-remote-workspace/profiles/save', { id: 'evil', host: 'evil.com' }, {
    'sec-fetch-site': 'cross-site',
    'host': '127.0.0.1:3000'
  });
  req1.socket = { remoteAddress: '127.0.0.1' };
  const res1 = createMockRes();
  await handler(req1, res1);

  assert.equal(res1.getStatusCode(), 403);
  assert.equal(res1.getBody().error, 'Forbidden');

  // Case 2: Loopback IP with cross-origin origin header (e.g. evil.com attacking localhost)
  const req2 = createMockReq('POST', '/dsh-remote-workspace/profiles/save', { id: 'evil', host: 'evil.com' }, {
    'sec-fetch-site': 'cross-site',
    'origin': 'http://evil.com',
    'host': '127.0.0.1:3000'
  });
  req2.socket = { remoteAddress: '127.0.0.1' };
  const res2 = createMockRes();
  await handler(req2, res2);

  assert.equal(res2.getStatusCode(), 403);
  assert.equal(res2.getBody().error, 'Forbidden');

  // Case 3: Loopback IP with same-origin and matching origin succeeds
  const req3 = createMockReq('POST', '/dsh-remote-workspace/profiles/save', { id: 'good', host: 'good.com' }, {
    'sec-fetch-site': 'same-origin',
    'origin': 'http://127.0.0.1:3000',
    'host': '127.0.0.1:3000'
  });
  req3.socket = { remoteAddress: '127.0.0.1' };
  const res3 = createMockRes();
  await handler(req3, res3);

  assert.equal(res3.getStatusCode(), 200);
});

test('API Routes [Issue #32]: rejects arbitrary Bearer token and cookie substring from untrusted address', async () => {
  const { registered } = setupTestRoutes();
  const handler = registered.get('/dsh-remote-workspace/profiles/save');

  // Case 1: Arbitrary Bearer token from remote IP without valid server token
  const req1 = createMockReq('POST', '/dsh-remote-workspace/profiles/save', { id: 'p3', host: '10.0.0.3' }, {
    'authorization': 'Bearer arbitrary-untrusted-token',
    'sec-fetch-site': undefined
  });
  req1.socket = { remoteAddress: '192.168.1.50' };
  const res1 = createMockRes();
  await handler(req1, res1);

  assert.equal(res1.getStatusCode(), 403);
  assert.equal(res1.getBody().error, 'Forbidden');

  // Case 2: Arbitrary cookie with token= substring from remote IP
  const req2 = createMockReq('POST', '/dsh-remote-workspace/profiles/save', { id: 'p3', host: '10.0.0.3' }, {
    'cookie': 'other=1; token=arbitrary-cookie; session=xyz',
    'sec-fetch-site': undefined
  });
  req2.socket = { remoteAddress: '192.168.1.50' };
  const res2 = createMockRes();
  await handler(req2, res2);

  assert.equal(res2.getStatusCode(), 403);
  assert.equal(res2.getBody().error, 'Forbidden');

  // Case 3: Legitimate configured token matches DSH_AUTH_TOKEN
  const prevEnv = process.env.DSH_AUTH_TOKEN;
  try {
    process.env.DSH_AUTH_TOKEN = 'secret-test-token-777';

    // Wrong token rejected
    const req3Bad = createMockReq('POST', '/dsh-remote-workspace/profiles/save', { id: 'p3', host: '10.0.0.3' }, {
      'authorization': 'Bearer wrong-secret',
      'sec-fetch-site': undefined
    });
    req3Bad.socket = { remoteAddress: '192.168.1.50' };
    const res3Bad = createMockRes();
    await handler(req3Bad, res3Bad);
    assert.equal(res3Bad.getStatusCode(), 403);

    // Matching token accepted
    const req3Good = createMockReq('POST', '/dsh-remote-workspace/profiles/save', { id: 'p3', host: '10.0.0.3', name: 'Server 3' }, {
      'authorization': 'Bearer secret-test-token-777',
      'sec-fetch-site': undefined
    });
    req3Good.socket = { remoteAddress: '192.168.1.50' };
    const res3Good = createMockRes();
    await handler(req3Good, res3Good);
    assert.equal(res3Good.getStatusCode(), 200);
  } finally {
    if (prevEnv !== undefined) process.env.DSH_AUTH_TOKEN = prevEnv;
    else delete process.env.DSH_AUTH_TOKEN;
  }
});

test('API Routes [Issue #31]: rejects untrusted GET requests across all 5 sensitive read endpoints', async () => {
  const { registered, mockStore } = setupTestRoutes();

  // Add a profile with a secret password and privateKey
  mockStore.getProfiles()[0].password = 'super-secret-password';
  mockStore.getProfiles()[0].privateKey = 'super-secret-key';

  const endpoints = [
    '/dsh-remote-workspace/state',
    '/dsh-remote-workspace/health',
    '/dsh-remote-workspace/docker/list',
    '/dsh-remote-workspace/terminal/stream',
    '/dsh-remote-workspace/tunnels/telemetry'
  ];

  for (const path of endpoints) {
    const handler = registered.get(path);
    assert.ok(handler, `Handler for ${path} should be registered`);

    const untrustedReq = createMockReq('GET', path, null, {
      'sec-fetch-site': 'cross-site'
    });
    untrustedReq.socket = { remoteAddress: '192.168.1.50' };
    const res = createMockRes();
    await handler(untrustedReq, res);

    assert.equal(res.getStatusCode(), 403, `${path} must return 403 for untrusted requests`);
    assert.equal(res.getBody().error, 'Forbidden');
  }

  // Verify that trusted /state request masks secrets even without store.vault
  const stateHandler = registered.get('/dsh-remote-workspace/state');
  const trustedReq = createMockReq('GET', '/dsh-remote-workspace/state', null, {
    'sec-fetch-site': 'same-origin'
  });
  const res = createMockRes();
  await stateHandler(trustedReq, res);

  assert.equal(res.getStatusCode(), 200);
  const data = res.getBody();
  assert.equal(data.ok, true);
  const prof = data.profiles[0];
  assert.equal(prof.password, '••••••••', 'Password must be masked');
  assert.equal(prof.privateKey, '••••••••', 'PrivateKey must be masked');
});

test('API Routes [Issue #72]: non-loopback client with forged Origin/Sec-Fetch/cookie/Bearer gets 403', async () => {
  const { registered } = setupTestRoutes();
  const handler = registered.get('/dsh-remote-workspace/profiles/save');

  const forgedReq = createMockReq('POST', '/dsh-remote-workspace/profiles/save', { id: 'p_evil', host: 'evil.host' }, {
    'sec-fetch-site': 'same-origin',
    'origin': 'http://127.0.0.1:3000',
    'host': '127.0.0.1:3000',
    'cookie': 'dsh_token=forged; token=forged',
    'authorization': 'Bearer forged-token'
  }, '203.0.113.50');

  const res = createMockRes();
  await handler(forgedReq, res);

  assert.equal(res.getStatusCode(), 403);
  assert.equal(res.getBody().error, 'Forbidden');
});

test('API Routes [Issue #72]: /cluster, /terminal/input, /file/save, /env/save, /docker/action do not invoke services when rejected', async () => {
  const { registered, getCounters } = setupTestRoutes();

  const endpoints = [
    { path: '/dsh-remote-workspace/cluster', method: 'POST', body: { command: 'reboot', profileIds: ['p1'] } },
    { path: '/dsh-remote-workspace/terminal/input', method: 'POST', body: { sessionId: 'term1', data: 'rm -rf /' } },
    { path: '/dsh-remote-workspace/file/save', method: 'POST', body: { profileId: 'p1', filePath: '/etc/passwd', content: 'evil' } },
    { path: '/dsh-remote-workspace/env/save', method: 'POST', body: { profileId: 'p1', remotePath: '/.env', content: 'SECRET=evil' } },
    { path: '/dsh-remote-workspace/docker/action', method: 'POST', body: { profileId: 'p1', containerId: 'c1', action: 'stop' } }
  ];

  for (const ep of endpoints) {
    const handler = registered.get(ep.path);
    assert.ok(handler, `Handler for ${ep.path} must exist`);

    const unauthReq = createMockReq(ep.method, ep.path, ep.body, {
      'sec-fetch-site': 'same-origin',
      'origin': 'http://127.0.0.1:3000',
      'host': '127.0.0.1:3000'
    }, '203.0.113.50');

    const res = createMockRes();
    await handler(unauthReq, res);

    assert.equal(res.getStatusCode(), 403, `${ep.path} must be rejected with 403`);
  }

  const counters = getCounters();
  assert.equal(counters.clusterExecuted, 0, 'cluster command must not execute on rejected request');
  assert.equal(counters.terminalInputSent, 0, 'terminal input must not be sent on rejected request');
  assert.equal(counters.fileSaved, 0, 'file must not be saved on rejected request');
  assert.equal(counters.envSaved, 0, 'env must not be saved on rejected request');
  assert.equal(counters.dockerActionCount, 0, 'docker action must not run on rejected request');
});

test('API Routes [Issue #72]: fails closed with 503 when connection service is unavailable', async () => {
  const { registered } = setupTestRoutes({ connection: null });
  const handler = registered.get('/dsh-remote-workspace/state');

  const req = createMockReq('GET', '/dsh-remote-workspace/state');
  const res = createMockRes();
  await handler(req, res);

  assert.equal(res.getStatusCode(), 503);
  assert.equal(res.getBody().error, 'DSH browser authentication is unavailable');
});

test('API Routes [Issue #72]: returns 401 when connection rejection indicates authentication required', async () => {
  const { registered } = setupTestRoutes({
    connection: {
      requestRejection: () => 401
    }
  });
  const handler = registered.get('/dsh-remote-workspace/state');

  const req = createMockReq('GET', '/dsh-remote-workspace/state');
  const res = createMockRes();
  await handler(req, res);

  assert.equal(res.getStatusCode(), 401);
  assert.equal(res.getBody().error, 'DSH browser authentication is required');
});
