import test from 'node:test';
import assert from 'node:assert/strict';
import { registerRemoteTools } from '../lib/tools.js';

function setupTools(activeProfile) {
  const tools = new Map();
  const mockCtx = {
    tools: {
      register(def) {
        tools.set(def.name, def);
      }
    }
  };

  const mockSsh = {
    exec: async (_p, cmd, dir) => ({ code: 0, stdout: `Executed: ${cmd} in ${dir}`, stderr: '' })
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

  registerRemoteTools(mockCtx, mockSsh, mockFs, mockSync, mockTunnel, () => activeProfile);
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
