export function filterClusterProfiles(profiles, filter = {}) {
  const aliases = new Set((filter.aliases || []).map((item) => String(item)));
  const tags = (filter.tags || []).map((item) => String(item).toLowerCase()).filter(Boolean);
  const environment = String(filter.environment || '').trim().toLowerCase();
  return (profiles || []).filter((profile) => {
    if (aliases.size && !aliases.has(String(profile.id)) && !aliases.has(String(profile.name || ''))) return false;
    if (environment && String(profile.environment || '').toLowerCase() !== environment) return false;
    if (tags.length) {
      const have = (Array.isArray(profile.tags) ? profile.tags : []).map((item) => String(item).toLowerCase());
      if (!tags.every((tag) => have.includes(tag))) return false;
    }
    return true;
  });
}

export async function runCluster(profiles, command, options = {}) {
  const list = profiles || [];
  if (!list.length) return [];
  const limit = Math.max(1, Math.min(Number(options.maxWorkers) || 8, list.length));
  const exec = options.exec;
  const results = new Array(list.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      const profile = list[index];
      const started = Date.now();
      try {
        const res = await exec(profile, command);
        results[index] = {
          alias: profile.name || profile.id || '',
          host: profile.host || '',
          success: (res.code ?? 0) === 0,
          exitCode: res.code ?? 0,
          durationMs: Date.now() - started,
          stdout: res.stdout || '',
          stderr: res.stderr || '',
          error: ''
        };
      } catch (err) {
        results[index] = {
          alias: profile.name || profile.id || '',
          host: profile.host || '',
          success: false,
          exitCode: null,
          durationMs: Date.now() - started,
          stdout: '',
          stderr: '',
          error: err && err.message ? err.message : 'failed'
        };
      }
    }
  };
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}
