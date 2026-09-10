export function writeJson(res, code, data) {
  try {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  } catch {}
}

export function readBody(req, maxBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/** Reject cross-site writes. LAN / reverse-proxy UIs are allowed. */
export function isTrustedSettingsRequest(request) {
  return request.headers['sec-fetch-site'] !== 'cross-site';
}

export function registerApiRoutes(ctx, sshService, remoteFs, mirrorSync, tunnelService, store) {
  ctx.inject(['webServer'], (sctx) => {
    const webServer = sctx.get ? (sctx.get('webServer') ?? sctx.webServer) : sctx.webServer;
    if (!webServer || typeof webServer.register !== 'function') return;

    // 1. GET /dsh-remote-workspace/state
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/state',
      handler: async (req, res) => {
        if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET only' });
        const profiles = store.getProfiles();
        const activeId = store.getActiveId();
        const tunnels = tunnelService.listActiveTunnels();
        writeJson(res, 200, { ok: true, profiles, activeId, tunnels });
      }
    }), 'dsh-remote-workspace: /state');

    // 2. POST /dsh-remote-workspace/profiles/save
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/profiles/save',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const profile = await readBody(req);
          if (!profile.id || !profile.host) {
            return writeJson(res, 400, { ok: false, error: 'ID and Host are required' });
          }
          sshService.invalidate(profile.id);
          await store.saveProfile(profile);
          writeJson(res, 200, { ok: true, profile });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /profiles/save');

    // 3. POST /dsh-remote-workspace/profiles/delete
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/profiles/delete',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const { id } = await readBody(req);
          if (!id) return writeJson(res, 400, { ok: false, error: 'ID is required' });
          sshService.disconnect(id);
          await store.deleteProfile(id);
          writeJson(res, 200, { ok: true });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /profiles/delete');

    // 4. POST /dsh-remote-workspace/profiles/active
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/profiles/active',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const { id } = await readBody(req);
          await store.setActiveId(id || null);
          writeJson(res, 200, { ok: true, activeId: store.getActiveId() });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /profiles/active');

    // 5. POST /dsh-remote-workspace/test
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/test',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const body = await readBody(req);
          const profile = body.profile || (body.id ? store.getProfile(body.id) : body);
          if (!profile || !profile.host) {
            return writeJson(res, 400, { ok: false, error: 'Invalid profile configuration' });
          }
          const result = await sshService.testConnection(profile);
          writeJson(res, 200, {
            ok: result.success,
            success: result.success,
            latency: result.latency,
            latencyMs: result.latency,
            os: result.os,
            remoteOs: result.os
          });
        } catch (err) {
          writeJson(res, 200, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /test');

    // 6. POST /dsh-remote-workspace/browse
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/browse',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const body = await readBody(req);
          const profile = body.profile || (body.profileId ? store.getProfile(body.profileId) : store.getActiveProfile());
          if (!profile || !profile.host) {
            return writeJson(res, 400, { ok: false, error: 'No profile specified' });
          }
          const remotePath = body.remotePath || '/';
          const entries = await remoteFs.listDir(profile, remotePath);
          writeJson(res, 200, { ok: true, currentPath: remotePath, entries });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /browse');

    // 7. POST /dsh-remote-workspace/sync
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/sync',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const { profileId, direction } = await readBody(req);
          const profile = (profileId ? store.getProfile(profileId) : null) || store.getActiveProfile();
          if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
          if (!profile.remoteWorkspace || !profile.localMirrorPath) {
            return writeJson(res, 400, { ok: false, error: 'Both remoteWorkspace and localMirrorPath must be configured' });
          }
          const resSync = direction === 'push'
            ? await mirrorSync.push(profile, profile.localMirrorPath, profile.remoteWorkspace)
            : await mirrorSync.pull(profile, profile.remoteWorkspace, profile.localMirrorPath);
          writeJson(res, 200, { ok: resSync.success, ...resSync });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /sync');

    // 8. POST /dsh-remote-workspace/tunnels/start
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/tunnels/start',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const { profileId, localPort, targetHost, remotePort } = await readBody(req);
          const profile = (profileId ? store.getProfile(profileId) : null) || store.getActiveProfile();
          if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
          const lPort = parseInt(localPort, 10);
          const rPort = parseInt(remotePort, 10);
          if (!lPort || !rPort) {
            return writeJson(res, 400, { ok: false, error: 'Valid localPort and remotePort required' });
          }
          const result = await tunnelService.startLocalTunnel(profile, lPort, targetHost || '127.0.0.1', rPort);
          writeJson(res, 200, { ok: result.success, ...result });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /tunnels/start');

    // 9. POST /dsh-remote-workspace/tunnels/stop
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/tunnels/stop',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const { tunnelId } = await readBody(req);
          if (!tunnelId) return writeJson(res, 400, { ok: false, error: 'tunnelId required' });
          const stopped = tunnelService.stopTunnel(tunnelId);
          writeJson(res, 200, { ok: stopped });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /tunnels/stop');
  });
}
