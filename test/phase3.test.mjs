import test from 'node:test';
import assert from 'node:assert/strict';
import { HealthService } from '../lib/health-service.js';
import { DockerService } from '../lib/docker-service.js';
import { WatcherService } from '../lib/watcher-service.js';

test('HealthService: parses uptime, memory, and disk usage accurately', async () => {
  const fakeProbeOutput = `
---UPTIME---
 18:30:15 up 12 days,  4:22,  2 users,  load average: 0.15, 0.22, 0.18
---MEM---
               total        used        free      shared  buff/cache   available
Mem:           15982        4210        8120         120        3652       11320
Swap:           4096           0        4096
---DISK---
Filesystem     1M-blocks      Used Available Use% Mounted on
/dev/sda1         245120     48210    184420  21% /
---CPU---
cpu  12345 678 9012 34567 890 123 456 0 0 0
`;

  const mockSsh = {
    exec: async () => ({ code: 0, stdout: fakeProbeOutput, stderr: '' })
  };

  const health = new HealthService(mockSsh);
  const data = await health.getHealth({ id: 'srv1', host: '127.0.0.1' });

  assert.equal(data.ok, true);
  assert.equal(data.uptime, '12 days,  4:22');
  assert.deepEqual(data.loadAverage, [0.15, 0.22, 0.18]);
  assert.equal(data.memory.totalMb, 15982);
  assert.equal(data.memory.usedMb, 4210);
  assert.equal(data.memory.percent, 26);
  assert.equal(data.disk.totalMb, 245120);
  assert.equal(data.disk.percent, 21);
});

test('DockerService: parses json format containers list', async () => {
  const fakeDockerOutput = [
    JSON.stringify({ ID: 'abc1234', Names: 'web-nginx', Image: 'nginx:alpine', Status: 'Up 2 hours', State: 'running', Ports: '0.0.0.0:80->80/tcp' }),
    JSON.stringify({ ID: 'def5678', Names: 'db-postgres', Image: 'postgres:16', Status: 'Exited (0) 5 mins ago', State: 'exited', Ports: '' })
  ].join('\n');

  let executedCmd = '';
  const mockSsh = {
    exec: async (_p, cmd) => {
      executedCmd = cmd;
      return { code: 0, stdout: fakeDockerOutput, stderr: '' };
    }
  };

  const docker = new DockerService(mockSsh);
  const res = await docker.listContainers({ id: 'srv1', host: '127.0.0.1' }, true);

  assert.equal(res.available, true);
  assert.equal(res.containers.length, 2);
  assert.equal(res.containers[0].names, 'web-nginx');
  assert.equal(res.containers[0].state, 'running');
  assert.equal(res.containers[1].names, 'db-postgres');
  assert.equal(res.containers[1].state, 'exited');
});

test('WatcherService: ignores node_modules and .git', () => {
  const watcher = new WatcherService();
  assert.equal(watcher.isIgnored('node_modules/express/index.js'), true);
  assert.equal(watcher.isIgnored('.git/HEAD'), true);
  assert.equal(watcher.isIgnored('.dsh-sync-snapshot.json'), true);
  assert.equal(watcher.isIgnored('file.tmp'), true);
  assert.equal(watcher.isIgnored('src/index.ts'), false);
  assert.equal(watcher.isIgnored('package.json'), false);
});
