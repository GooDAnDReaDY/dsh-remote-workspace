export function normalizeTags(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function bucket(map, key, profile) {
  const name = key || 'ungrouped';
  if (!map.has(name)) map.set(name, []);
  map.get(name).push(profile);
}

export function groupProfiles(profiles, mode) {
  const list = Array.isArray(profiles) ? profiles : [];
  if (mode === 'environment') {
    const map = new Map();
    for (const profile of list) bucket(map, String(profile.environment || '').trim(), profile);
    return [...map.entries()].map(([key, items]) => ({ key, items }));
  }
  if (mode === 'tag') {
    const map = new Map();
    for (const profile of list) {
      const tags = normalizeTags(profile.tags);
      if (!tags.length) bucket(map, '', profile);
      else for (const tag of tags) bucket(map, tag, profile);
    }
    return [...map.entries()].map(([key, items]) => ({ key, items }));
  }
  return [{ key: 'all', items: list }];
}

export async function testProfileGroup(profiles, testOne) {
  const results = [];
  const queue = [...(profiles || [])];
  const workers = Array.from({ length: Math.min(4, Math.max(queue.length, 1)) }, async () => {
    while (queue.length) {
      const profile = queue.shift();
      if (!profile) return;
      const started = Date.now();
      try {
        const result = await testOne(profile);
        results.push({
          id: profile.id,
          name: profile.name || profile.host,
          ok: true,
          latencyMs: result.latencyMs ?? result.latency ?? (Date.now() - started)
        });
      } catch (err) {
        results.push({
          id: profile.id,
          name: profile.name || profile.host,
          ok: false,
          error: err && err.message ? err.message : 'Connection failed'
        });
      }
    }
  });
  if (!queue.length) return results;
  await Promise.all(workers);
  return results;
}
