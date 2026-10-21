import test from 'node:test';
import assert from 'node:assert/strict';
import { registerRemoteTools, resolveWorkspacePath } from '../lib/tools.js';

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
    'remote_workspace_exec',
    'remote_workspace_search',
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

  assert.equal(tools.size, 13, 'All 13 remote tools must be registered');

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

test('Tools: remote_env masks secrets on full read and retrieves specific key (Fixes #103)', async () => {
  const profile = { id: 'p1', remoteWorkspace: '/remote/dir' };
  const tools = setupTools(profile);
  const tool = tools.get('remote_env');
  assert.ok(tool);

  // 1. Full read returns masked values and key list without dumping raw secrets
  const fullRes = await tool.execute({ action: 'read', filePath: '/app/.env' });
  assert.ok(Array.isArray(fullRes.keys));
  assert.ok(fullRes.keys.includes('PORT'));
  assert.ok(!JSON.stringify(fullRes).includes('3000'), 'Full read must not expose unmasked variable values');
  assert.ok(fullRes.entries.every((e) => !e.value || e.value === '••••••••'));

  // 2. Targeted read with key returns the specific value
  const keyRes = await tool.execute({ action: 'read', filePath: '/app/.env', key: 'PORT' });
  assert.equal(keyRes.key, 'PORT');
  assert.equal(keyRes.exists, true);
  assert.equal(keyRes.value, '3000');
});

test('Tools: remote_service validates actions and sanitizes shell arguments (Fixes #90)', async () => {
  let executedCmd = '';
  const profile = { id: 'p1', remoteWorkspace: '/remote/dir' };
  const tools = setupTools(profile);
  const tool = tools.get('remote_service');
  assert.ok(tool);

  // 1. Rejects unwhitelisted action
  await assert.rejects(async () => {
    await tool.execute({ service: 'nginx', action: 'restart; rm -rf /' });
  }, /Invalid service action/);

  // 2. Rejects unwhitelisted manager
  await assert.rejects(async () => {
    await tool.execute({ service: 'nginx', action: 'status', manager: 'docker' });
  }, /Invalid service manager/);

  // 3. Posix-quotes dangerous service names against shell expansion
  const res = await tool.execute({ service: 'app$(whoami)`id`', action: 'restart' });
  assert.equal(res.exitCode, 0);
  assert.ok(res.output.includes("'app$(whoami)`id`'"), 'Command must POSIX-quote service name without shell interpolation');
});

test('Tools: remote_fs confines operations to workspace root and blocks path traversal (Fixes #93)', async () => {
  const profile = { id: 'p1', remoteWorkspace: '/remote/dir' };
  const tools = setupTools(profile);
  const tool = tools.get('remote_fs');
  assert.ok(tool);

  // 1. Relative path resolves within workspace
  const relRead = await tool.execute({ action: 'read', path: 'src/index.js' });
  assert.equal(relRead.content, 'content of /remote/dir/src/index.js');

  // 2. Path outside workspace throws access denied
  await assert.rejects(async () => {
    await tool.execute({ action: 'read', path: '/etc/passwd' });
  }, /outside configured remoteWorkspace/);

  // 3. Directory traversal escaping workspace throws access denied
  await assert.rejects(async () => {
    await tool.execute({ action: 'read', path: '../../etc/passwd' });
  }, /outside configured remoteWorkspace/);

  // 4. Reject removing workspace root directory
  await assert.rejects(async () => {
    await tool.execute({ action: 'remove', path: '/remote/dir' });
  }, /Cannot remove root workspace directory/);

  await assert.rejects(async () => {
    await tool.execute({ action: 'remove', path: '.' });
  }, /Cannot remove root workspace directory/);

  // 5. Reject null bytes
  await assert.rejects(async () => {
    await tool.execute({ action: 'read', path: 'file\0.txt' });
  }, /without null bytes/);

  // 6. Reject if remoteWorkspace is missing or empty
  const noWsTools = setupTools({ id: 'p2', remoteWorkspace: '' });
  const noWsTool = noWsTools.get('remote_fs');
  await assert.rejects(async () => {
    await noWsTool.execute({ action: 'read', path: 'app.js' });
  }, /Remote workspace is not configured/);
});

test('Tools [Fixes #105]: tool render returns [{ type: "text", text }] array per framework contract', () => {
  const profile = { id: 'p1', remoteWorkspace: '/remote/dir' };
  const tools = setupTools(profile);

  for (const [name, tool] of tools) {
    assert.ok(tool.output, `Tool ${name} must define output`);
    assert.equal(typeof tool.output.render, 'function', `Tool ${name} must have output.render function`);

    // Render with test object
    const sampleObj = { ok: true, message: 'hello world' };
    const renderedObj = tool.output.render({}, sampleObj);
    assert.ok(Array.isArray(renderedObj), `Tool ${name} render must return an array`);
    assert.equal(renderedObj.length, 1);
    assert.equal(renderedObj[0].type, 'text');
    assert.equal(typeof renderedObj[0].text, 'string');
    assert.equal(renderedObj[0].content, undefined, 'Must not use legacy content property');

    // Render with test string
    const sampleStr = 'raw text output';
    const renderedStr = tool.output.render({}, sampleStr);
    assert.ok(Array.isArray(renderedStr));
    assert.equal(renderedStr[0].type, 'text');
    assert.equal(typeof renderedStr[0].text, 'string');
  }

  // Specifically check remote_hosts table rendering
  const hostsTool = tools.get('remote_hosts');
  const hostsRendered = hostsTool.output.render({}, { count: 1, table: '| Host | IP |\n| test | 127.0.0.1 |' });
  assert.ok(Array.isArray(hostsRendered));
  assert.equal(hostsRendered[0].type, 'text');
  assert.ok(hostsRendered[0].text.includes('| Host | IP |'));
});

test('Tools [Fixes #119]: remote_fs rejects relative remoteWorkspace and blocks symlink-escape via realpath', async () => {
  // 1. Reject relative remoteWorkspace in resolveWorkspacePath
  for (const relWs of ['relative/workspace', './workspace', '../workspace', 'workspace']) {
    assert.throws(() => {
      resolveWorkspacePath(relWs, 'file.txt');
    }, /Remote workspace must be an absolute path/);
  }

  const relTools = setupTools({ id: 'p-rel', remoteWorkspace: 'relative/dir' });
  const relFsTool = relTools.get('remote_fs');
  await assert.rejects(async () => {
    await relFsTool.execute({ action: 'read', path: 'app.js' });
  }, /Remote workspace must be an absolute path/);

  // 2. Block symlink-escape where lexical path is inside workspace but SFTP realpath resolves outside
  const profile = { id: 'p-sym', remoteWorkspace: '/remote/dir' };
  const tools = new Map();
  const mockCtx = { tools: { register(def) { tools.set(def.name, def); } } };
  const mockSsh = { exec: async () => ({ code: 0, stdout: '', stderr: '' }) };
  const mockFs = {
    realpath: async (_p, checkPath) => {
      if (checkPath === '/remote/dir') return '/remote/dir';
      if (checkPath === '/remote/dir/evil-link') return '/etc/shadow';
      if (checkPath === '/remote/dir/EscapeDir') return '/root';
      if (checkPath === '/remote/dir/safe-link') return '/remote/dir/subdir/config.json';
      throw new Error('ENOENT');
    },
    readFile: async (_p, p) => `read:${p}`,
    writeFile: async (_p, p, c) => ({ success: true, path: p, bytes: c.length })
  };

  registerRemoteTools(mockCtx, mockSsh, mockFs, {}, {}, () => profile, () => profile);
  const fsTool = tools.get('remote_fs');

  // Symlink pointing to /etc/shadow must be blocked on read
  await assert.rejects(async () => {
    await fsTool.execute({ action: 'read', path: 'evil-link' });
  }, /escapes configured remoteWorkspace/);

  // Non-existent file inside a symlinked parent directory pointing to /root must be blocked on write
  await assert.rejects(async () => {
    await fsTool.execute({ action: 'write', path: 'EscapeDir/authorized_keys', content: 'ssh-rsa ...' });
  }, /escapes configured remoteWorkspace/);

  // Legitimate symlink resolving within workspace succeeds
  const safeRes = await fsTool.execute({ action: 'read', path: 'safe-link' });
  assert.equal(safeRes.content, 'read:/remote/dir/subdir/config.json');
});
