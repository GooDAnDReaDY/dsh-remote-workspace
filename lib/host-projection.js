const SECRET = ['password', 'privateKey', 'privateKeyPath', 'passphrase', 'agentPath', 'proxyCommand'];

/**
 * One host row safe to place in a model context.
 * @param {any} profile
 */
export function toAgentHostRow(profile) {
  const jump = Boolean(
    (typeof profile?.jumpHostId === 'string' && profile.jumpHostId.trim())
    || (Array.isArray(profile?.jumpHosts) && profile.jumpHosts.length)
  );
  const proxy = Boolean(typeof profile?.proxyCommand === 'string' && profile.proxyCommand.trim());
  const access = [jump ? 'jump' : '', proxy ? 'proxy' : ''].filter(Boolean).join(',') || 'direct';
  return {
    alias: String(profile?.name || profile?.id || ''),
    host: String(profile?.host || ''),
    port: profile?.port || 22,
    user: String(profile?.username || ''),
    auth: String(profile?.authType || 'key'),
    access,
    env: String(profile?.environment || ''),
    tags: Array.isArray(profile?.tags) ? profile.tags.map((item) => String(item)).join(',') : '',
    description: String(profile?.description || '')
  };
}

/**
 * @param {any[]} profiles
 */
export function renderHostTable(profiles) {
  const header = 'alias | host | port | user | auth | jump/proxy | env | tags | description';
  const lines = (profiles || []).map((profile) => {
    const row = toAgentHostRow(profile);
    return [row.alias, row.host, row.port, row.user, row.auth, row.access, row.env, row.tags, row.description].join(' | ');
  });
  return [header, ...lines].join('\n');
}

export function hostProjectionLeaks(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return SECRET.some((key) => text.includes(key));
}
