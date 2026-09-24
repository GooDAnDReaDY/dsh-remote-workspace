/**
 * ssh2 agent endpoint for a profile. Pageant is the Windows name ssh2 understands.
 * A private key is never read for this auth type.
 * @param {any} profile
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [platform]
 */
export function resolveAgentEndpoint(profile, env = process.env, platform = process.platform) {
  if (profile?.authType !== 'agent') return undefined;
  const raw = String(profile.agentPath || '').trim();
  if (raw.toLowerCase() === 'pageant') return 'pageant';
  if (raw) return raw;
  if (env && env.SSH_AUTH_SOCK) return env.SSH_AUTH_SOCK;
  if (platform === 'win32') return 'pageant';
  return undefined;
}
