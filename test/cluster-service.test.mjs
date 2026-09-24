import test from 'node:test';
import assert from 'node:assert/strict';
import { filterClusterProfiles, runCluster } from '../lib/cluster-service.js';

test('filterClusterProfiles keeps hosts that match every tag and the environment', () => {
  const profiles = [
    { id: 'a', name: 'a', environment: 'prod', tags: ['web', 'db'] },
    { id: 'b', name: 'b', environment: 'prod', tags: ['web'] },
    { id: 'c', name: 'c', environment: 'dev', tags: ['web', 'db'] }
  ];
  const selected = filterClusterProfiles(profiles, { environment: 'prod', tags: ['web', 'db'] });
  assert.deepEqual(selected.map((item) => item.id), ['a']);
});

test('runCluster limits parallelism and records each host', async () => {
  let active = 0;
  let peak = 0;
  const profiles = [{ id: 'a', name: 'a', host: 'a.example' }, { id: 'b', name: 'b', host: 'b.example' }, { id: 'c', name: 'c', host: 'c.example' }];
  const results = await runCluster(profiles, 'uname', {
    maxWorkers: 2,
    exec: async (profile) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
      if (profile.id === 'b') throw new Error('down');
      return { code: 0, stdout: profile.id, stderr: '' };
    }
  });
  assert.equal(peak <= 2, true);
  assert.equal(results[0].success, true);
  assert.equal(results[1].error, 'down');
  assert.equal(results[2].stdout, 'c');
});
