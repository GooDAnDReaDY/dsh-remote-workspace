import test from 'node:test';
import assert from 'node:assert/strict';
import { registerRemoteTools } from '../lib/tools.js';

function setupTools(activeProfile, options = {}) {
  const tools = new Map();
  const mockCtx = {
    tools: {
      register(def) {
        tools.set(def.name, def);
      }
    }
  };

  const mockSsh = {
    exec: async (_p, cmd, dir) => ({ code: 0, stdout: `Executed: ${cmd} in ${dir}`, stderr: '' }),
    transferFileBetweenHosts: async () => ({ success: true, bytesTransferred: 42 })
  };

  const mockFs = {
    readFile: async (_p, path) => `content of ${path}`,
    writeFile: async (_p, path, content) => ({ success: true, bytes: content.length }),
    stat: async (_p, path) => ({ isDirectory: false, isFile: true, size: 100 }),
    listDir: async (_p, path) => [{ filename: 'file.txt', isDirectory: false, isFile: true }],
    mkdir: async (_p, path) => ({ success: true }),
    remove: async (_p, path, rec) => ({ success: true })
  };

  const mockSync = {
    pull: async () => ({ success: true, pulled: ['a.txt'] }),
    push: async () => ({ success: true, pushed: ['b.txt'] })
  };

  const mockTunnel = {
    listActiveTunnels: () => [{ id: 'tun1', localPort: 8080, remotePort: 80 }],
    startLocalTunnel: async () => ({ success: true, tunnelId: 'tun1' }),
    stopTunnel: () => true
  };

  const mockDocker = options.docker !== false ? {
    listContainers: async () => [{ Id: 'c1', Names: ['/web'] }],
    containerLogs: async () => 'container logs',
    containerAction: async () => ({ success: true }),
    composeAction: async () => ({ success: true })
  } : null;

  const mockDiagnose = options.diagnose !== false ? {
    diagnose: async (_p, category, target) => ({ category, target, ok: true, output: 'diagnostics passed' })
  } : null;

  const mockEnv = options.env !== false ? {
    readEnv: async () => ({ raw: 'PORT=3000', variables: { PORT: '3000' } }),
    setEnvVar: async () => ({ success: true, key: 'PORT', value: '3000' })
  } : null;

  const mockTarSync = options.tarSync !== false ? {
    pullTar: async () => ({ success: true, mode: 'tarball' }),
    pushTar: async () => ({ success: true, mode: 'tarball' })
  } : null;

  registerRemoteTools(
    mockCtx,
    mockSsh,
    mockFs,
    mockSync,
    mockTunnel,
    () => activeProfile,
    (id) => (activeProfile && activeProfile.id === id ? activeProfile : null),
    mockDocker,
    mockDiagnose,
    mockEnv,
    mockTarSync
  );
  return tools;
}

test('Tools: remote_exec executes with active profile', async () => {
  const profile = { id: 'p1', remoteWorkspace: '/remote/dir' };
  const tools = setupTools(profile);
  const tool = tools.get('remote_exec');
  assert.ok(tool);

  const res = await tool.execute({ command: 'ls -la' });
  assert.equal(res.exitCode, 0);
  assert.ok(res.stdout.includes('ls -la'));
});

test('Tools: remote_exec throws if no active profile', async () => {
  const tools = setupTools(null);
  const tool = tools.get('remote_exec');
  await assert.rejects(async () => {
    await tool.execute({ command: 'ls' });
  }, /No active remote workspace profile/);
});

test('Tools: remote_fs supports read, write, stat, list, mkdir, remove', async () => {
  const profile = { id: 'p1', remoteWorkspace: '/remote/dir' };
  const tools = setupTools(profile);
  const tool = tools.get('remote_fs');

  // read
  const readRes = await tool.execute({ action: 'read', path: '/remote/dir/app.js' });
  assert.equal(readRes.content, 'content of /remote/dir/app.js');

  // write
  const writeRes = await tool.execute({ action: 'write', path: '/remote/dir/app.js', content: 'hello' });
  assert.equal(writeRes.success, true);

  // stat
  const statRes = await tool.execute({ action: 'stat', path: '/remote/dir/app.js' });
  assert.equal(statRes.isFile, true);

  // list
  const listRes = await tool.execute({ action: 'list', path: '/remote/dir' });
  assert.equal(listRes.entries.length, 1);

  // mkdir
  const mkdirRes = await tool.execute({ action: 'mkdir', path: '/remote/dir/newdir' });
  assert.equal(mkdirRes.success, true);

  // remove
  const removeRes = await tool.execute({ action: 'remove', path: '/remote/dir/old.js' });
  assert.equal(removeRes.success, true);
});

test('Tools: remote_sync handles pull and push', async () => {
  const profile = { id: 'p1', remoteWorkspace: '/remote/dir', localMirrorPath: '/local/dir' };
  const tools = setupTools(profile);
  const tool = tools.get('remote_sync');

  const pullRes = await tool.execute({ direction: 'pull' });
  assert.equal(pullRes.success, true);
  assert.deepEqual(pullRes.pulled, ['a.txt']);

  const pushRes = await tool.execute({ direction: 'push' });
  assert.equal(pushRes.success, true);
  assert.deepEqual(pushRes.pushed, ['b.txt']);
});

test('Tools: remote_tunnel handles list, start, stop', async () => {
  const profile = { id: 'p1' };
  const tools = setupTools(profile);
  const tool = tools.get('remote_tunnel');

  const listRes = await tool.execute({ action: 'list' });
  assert.equal(listRes.tunnels.length, 1);

  const startRes = await tool.execute({ action: 'start', localPort: 8080, remotePort: 80 });
  assert.equal(startRes.success, true);

  const stopRes = await tool.execute({ action: 'stop', tunnelId: 'tun1' });
  assert.equal(stopRes.success, true);
});

// Regression tests for Issue #33: JSON Schema root must be type "object"
test('Tools [Issue #33]: remote tools compile valid object-root JSON Schema', () => {
  const profile = { id: 'p1', remoteWorkspace: '/remote/dir' };
  const tools = setupTools(profile);

  const expectedTools = [
    'remote_exec',
    'remote_fs',
    'remote_sync',
    'remote_tunnel',
    'remote_docker',
    'remote_service',
    'remote_transfer',
    'remote_diagnose',
    'remote_env',
    'remote_hosts',
    'remote_cluster'
  ];

  assert.equal(tools.size, 11, 'All 11 remote tools must be registered');

  for (const name of expectedTools) {
    const tool = tools.get(name);
    assert.ok(tool, `Tool ${name} must be registered`);
    assert.equal(typeof tool.name, 'string');
    assert.equal(typeof tool.description, 'string');

    // JSON Schema root requirements for LLM / OpenAI API compatibility:
    assert.ok(tool.parameters, `Tool ${name} must have parameters`);
    assert.equal(tool.parameters.type, 'object', `Tool ${name} root parameters.type must be "object"`);
    assert.equal(typeof tool.parameters.properties, 'object', `Tool ${name} parameters.properties must be an object`);
    assert.ok(Object.keys(tool.parameters.properties).length > 0, `Tool ${name} must have at least one parameter property`);
    assert.ok(Array.isArray(tool.parameters.required), `Tool ${name} parameters.required must be an array`);

    // Output schema validation
    assert.ok(tool.output, `Tool ${name} must have output definition`);
    assert.ok(tool.output.schema, `Tool ${name} must have output.schema`);
    assert.equal(tool.output.schema.type, 'object');
  }
});

test('Tools [Issue #33]: remote_diagnose schema and execution validation', async () => {
  const profile = { id: 'p1', remoteWorkspace: '/remote/dir' };
  const tools = setupTools(profile);
  const tool = tools.get('remote_diagnose');

  assert.ok(tool);
  assert.equal(tool.parameters.type, 'object');
  assert.deepEqual(tool.parameters.required, ['category']);
  assert.equal(tool.parameters.properties.category.type, 'string');
  assert.equal(tool.parameters.properties.target.type, 'string');

  // Valid invocation
  const res = await tool.execute({ category: 'ports', target: '8080' });
  assert.equal(res.ok, true);
  assert.equal(res.category, 'ports');
  assert.equal(res.target, '8080');

  // Missing required parameter throws ToolArgsError
  await assert.rejects(async () => {
    await tool.execute({});
  }, /missing required property "category"/);
});

test('Tools [Issue #33]: remote_transfer schema and execution validation', async () => {
  const profile = { id: 'p1', remoteWorkspace: '/remote/dir' };
  const tools = setupTools(profile);
  const tool = tools.get('remote_transfer');

  assert.ok(tool);
  assert.equal(tool.parameters.type, 'object');
  assert.deepEqual(tool.parameters.required.sort(), ['destPath', 'destProfileId', 'sourcePath'].sort());

  // Missing required properties throws ToolArgsError
  await assert.rejects(async () => {
    await tool.execute({ sourcePath: '/a' });
  }, /missing required property/);
});
