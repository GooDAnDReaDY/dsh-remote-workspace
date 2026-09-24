import test from 'node:test';
import assert from 'node:assert/strict';
import { groupProfiles, testProfileGroup } from '../lib/profile-groups.js';

test('groupProfiles buckets hosts by environment and tag', () => {
  const profiles = [
    { id: 'a', environment: 'prod', tags: ['web', 'db'] },
    { id: 'b', environment: 'prod', tags: [] },
    { id: 'c', environment: '', tags: ['web'] }
  ];
  const byEnv = groupProfiles(profiles, 'environment');
  assert.deepEqual(byEnv.map((item) => [item.key, item.items.map((p) => p.id)]), [['prod', ['a', 'b']], ['ungrouped', ['c']]]);
  const byTag = groupProfiles(profiles, 'tag');
  const web = byTag.find((item) => item.key === 'web');
  assert.deepEqual(web.items.map((p) => p.id), ['a', 'c']);
});

test('testProfileGroup records success and failure for each host', async () => {
  const results = await testProfileGroup(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    async (profile) => {
      if (profile.id === 'b') throw new Error('refused');
      return { latencyMs: 12 };
    }
  );
  const byId = Object.fromEntries(results.map((item) => [item.id, item]));
  assert.equal(byId.a.ok, true);
  assert.equal(byId.a.latencyMs, 12);
  assert.equal(byId.b.ok, false);
  assert.equal(byId.b.error, 'refused');
});
