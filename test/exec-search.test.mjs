import test from 'node:test';
import assert from 'node:assert/strict';
import { registerRemoteTools } from '../lib/tools.js';
import { registerExecRoutes } from '../lib/routes/exec.js';
import { registerSearchRoutes } from '../lib/routes/search.js';
import { SshService } from '../lib/ssh-service.js';

function createMockReq(method, path, body = null, headers = {}, remoteAddress = '127.0.0.1') {
  const listeners = {};
  let destroyed = false;
  const req = {
    method,
    url: path,
    headers: { 'sec-fetch-site': 'same-origin', ...headers },
    socket: { remoteAddress },
    on(event, cb) {
      listeners[event] = cb;
      if (event === 'end') {
        process.nextTick(() => {
          if (destroyed) return;
          if (body !== null && listeners['data']) {
            const str = typeof body === 'string' ? body : JSON.stringify(body);
            listeners['data'](Buffer.from(str));
          }
          if (!destroyed && listeners['end']) cb();
        });
      }
    },
    removeListener(event, cb) {
      if (listeners[event] === cb) delete listeners[event];
    },
    off(event, cb) {
      if (listeners[event] === cb) delete listeners[event];
    },
    destroy() {
      destroyed = true;
      delete listeners['data'];
      delete listeners['end'];
    },
    isDestroyed() { return destroyed; },
    getListeners() { return listeners; }
  };
  return req;
}

function createMockRes() {
  let statusCode = 200;
  let headers = {};
  let body = '';
  const res = {
    get statusCode() { return statusCode; },
    set statusCode(v) { statusCode = v; },
    writeHead(code, h) {
      statusCode = code;
      if (h) Object.assign(headers, h);
    },
    setHeader(k, v) {
      headers[k.toLowerCase()] = v;
    },
    end(data) {
      if (data) body += data;
    },
    getStatusCode() { return statusCode; },
    getHeaders() { return headers; },
    getBody() {
      try { return JSON.parse(body); } catch (_) { return body; }
    }
  };
  return res;
}

function createMockSctx() {
  const connection = {
    requestRejection() {
      return undefined;
    }
  };
  return {
    get(name) {
      if (name === 'connection') return connection;
      return null;
    },
    connection,
    effect(fn) { fn(); }
  };
}

test('SshService: searchCodebase formats search query and parses matches correctly', async () => {
  const service = new SshService();
  const profile = { id: 'p1', remoteWorkspace: '/var/www' };

  let capturedCmd = '';
  let capturedOpts = null;
  service.exec = async (_p, cmd, opts) => {
    capturedCmd = cmd;
    capturedOpts = opts;
    return {
      code: 0,
      stdout: '/var/www/src/index.js:12:const a = 1;\n/var/www/src/utils.js:45:const b = 2;\n',
      stderr: '',
    };
  };

  const res = await service.searchCodebase(profile, {
    query: 'const',
    path: '/var/www',
    maxResults: 10,
    filePattern: '*.js',
  });

  assert.equal(res.query, 'const');
  assert.equal(res.totalMatches, 2);
  assert.equal(res.matches.length, 2);
  assert.equal(res.matches[0].file, 'src/index.js');
  assert.equal(res.matches[0].line, 12);
  assert.equal(res.matches[0].text, 'const a = 1;');
  assert.equal(res.matches[1].file, 'src/utils.js');
  assert.equal(res.matches[1].line, 45);
  assert.equal(res.truncated, false);
  assert.ok(capturedCmd.includes('const'));
  assert.equal(capturedOpts.cwd, '/var/www');
});

test('SshService: searchCodebase rejects empty query', async () => {
  const service = new SshService();
  const profile = { id: 'p1', remoteWorkspace: '/var/www' };
  await assert.rejects(async () => {
    await service.searchCodebase(profile, { query: '' });
  }, /Search query is required/);
});

test('Tools: remote_workspace_exec executes command with timeout and buffer cap', async () => {
  const tools = new Map();
  const mockCtx = {
    tools: {
      register(def) { tools.set(def.name, def); }
    }
  };

  let execCalled = false;
  let passedOpts = null;
  const mockSsh = {
    exec: async (_p, cmd, opts) => {
      execCalled = true;
      passedOpts = opts;
      return { code: 0, stdout: 'hello world\n', stderr: '', signal: null };
    }
  };

  const profile = { id: 'p1', remoteWorkspace: '/app' };
  registerRemoteTools(mockCtx, mockSsh, {}, {}, {}, () => profile, () => profile);

  const execTool = tools.get('remote_workspace_exec');
  assert.ok(execTool, 'remote_workspace_exec tool must be registered');

  const res = await execTool.execute({
    command: 'npm test',
    timeout: 45,
    maxBufferSize: 32768,
  });

  assert.ok(execCalled);
  assert.equal(res.exitCode, 0);
  assert.equal(res.stdout, 'hello world\n');
  assert.equal(passedOpts.cwd, '/app');
  assert.equal(passedOpts.timeout, 45);
  assert.equal(passedOpts.maxBufferSize, 32768);
  assert.equal(typeof res.executionTimeMs, 'number');
});

test('Tools: remote_workspace_search searches codebase and returns structured matches', async () => {
  const tools = new Map();
  const mockCtx = {
    tools: {
      register(def) { tools.set(def.name, def); }
    }
  };

  let searchCalled = false;
  const mockSsh = {
    searchCodebase: async (_p, opts) => {
      searchCalled = true;
      return {
        query: opts.query,
        path: opts.path,
        matches: [{ file: 'main.py', line: 10, text: 'import os' }],
        totalMatches: 1,
        truncated: false,
      };
    }
  };

  const profile = { id: 'p1', remoteWorkspace: '/app' };
  registerRemoteTools(mockCtx, mockSsh, {}, {}, {}, () => profile, () => profile);

  const searchTool = tools.get('remote_workspace_search');
  assert.ok(searchTool, 'remote_workspace_search tool must be registered');

  const res = await searchTool.execute({
    query: 'import os',
  });

  assert.ok(searchCalled);
  assert.equal(res.query, 'import os');
  assert.equal(res.totalMatches, 1);
  assert.equal(res.matches[0].file, 'main.py');
});

test('Routes: POST /dsh-remote-workspace/exec handles execution and errors', async () => {
  let registeredHandler = null;
  const mockWebServer = {
    register: (def) => {
      if (def.path === '/dsh-remote-workspace/exec') registeredHandler = def.handler;
    }
  };
  const mockSctx = createMockSctx();

  const profile = { id: 'p1', remoteWorkspace: '/srv' };
  const mockStore = {
    getProfile: (id) => (id === 'p1' ? profile : null),
    getActiveProfile: () => profile,
  };
  const mockSsh = {
    exec: async (_p, cmd, opts) => ({ code: 0, stdout: 'ok', stderr: '' })
  };

  registerExecRoutes(mockSctx, mockWebServer, { store: mockStore, sshService: mockSsh });
  assert.ok(registeredHandler, 'Exec handler must be registered');

  // Test 405 on GET
  const getReq = createMockReq('GET', '/dsh-remote-workspace/exec');
  const getRes = createMockRes();
  await registeredHandler(getReq, getRes);
  assert.equal(getRes.getStatusCode(), 405);

  // Test POST success
  const postReq = createMockReq('POST', '/dsh-remote-workspace/exec', { profileId: 'p1', command: 'uptime' });
  const postRes = createMockRes();
  await registeredHandler(postReq, postRes);
  assert.equal(postRes.getStatusCode(), 200);
  assert.equal(postRes.getBody().ok, true);
  assert.equal(postRes.getBody().stdout, 'ok');
});

test('Routes: POST /dsh-remote-workspace/search handles codebase search and validation', async () => {
  let registeredHandler = null;
  const mockWebServer = {
    register: (def) => {
      if (def.path === '/dsh-remote-workspace/search') registeredHandler = def.handler;
    }
  };
  const mockSctx = createMockSctx();

  const profile = { id: 'p1', remoteWorkspace: '/srv' };
  const mockStore = {
    getProfile: (id) => (id === 'p1' ? profile : null),
    getActiveProfile: () => profile,
  };
  const mockSsh = {
    searchCodebase: async (_p, opts) => ({
      query: opts.query,
      path: opts.path,
      matches: [{ file: 'server.js', line: 1, text: 'const http = require("http");' }],
      totalMatches: 1,
      truncated: false,
    })
  };

  registerSearchRoutes(mockSctx, mockWebServer, { store: mockStore, sshService: mockSsh });
  assert.ok(registeredHandler, 'Search handler must be registered');

  // Test POST search success
  const postReq = createMockReq('POST', '/dsh-remote-workspace/search', { profileId: 'p1', query: 'const http' });
  const postRes = createMockRes();
  await registeredHandler(postReq, postRes);
  assert.equal(postRes.getStatusCode(), 200);
  assert.equal(postRes.getBody().ok, true);
  assert.equal(postRes.getBody().matches.length, 1);
  assert.equal(postRes.getBody().matches[0].file, 'server.js');
});
