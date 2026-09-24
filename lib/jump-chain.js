/**
 * Jump ids from an explicit list, or from a comma-separated jumpHostId.
 * @param {any} profile
 * @returns {string[]}
 */
export function resolveJumpHops(profile) {
  if (Array.isArray(profile?.jumpHosts) && profile.jumpHosts.length) {
    return profile.jumpHosts.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof profile?.jumpHostId === 'string' && profile.jumpHostId.trim()) {
    return profile.jumpHostId.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

/**
 * @param {any} client
 * @param {string} host
 * @param {number} port
 */
export function forwardOut(client, host, port) {
  return new Promise((resolve, reject) => {
    client.forwardOut('127.0.0.1', 0, host, port || 22, (err, stream) => {
      if (err) reject(err);
      else resolve(stream);
    });
  });
}

/**
 * Connect through bastions in order. Only clients created after the first hop
 * are released with the target; the first hop stays in the shared pool.
 */
export async function openJumpChain(target, hopProfiles, deps) {
  if (!hopProfiles.length) throw new Error('Jump chain is empty');
  const intermediates = [];
  const release = () => {
    for (const extra of intermediates) {
      try { extra.end(); } catch { /* already closed */ }
    }
  };
  try {
    let client = await deps.connectPooled(hopProfiles[0]);
    for (let i = 1; i < hopProfiles.length; i += 1) {
      const hop = hopProfiles[i];
      const stream = await forwardOut(client, hop.host, hop.port || 22);
      client = await deps.connectDedicated(hop, stream);
      intermediates.push(client);
    }
    const sock = await forwardOut(client, target.host, target.port || 22);
    return { sock, release };
  } catch (err) {
    release();
    throw err;
  }
}
