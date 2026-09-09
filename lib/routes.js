function writeJson(res, code, data) {
  try {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  } catch {}
}

function readBody(req, maxBytes = 256 * 1024) {
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

export function registerApiRoutes(ctx, sshService, remoteFs, mirrorSync, tunnelService, store) {
  ctx.inject(['webServer'], (sctx) => {
    // 1. GET /dsh-remote-workspace/state
    sctx.effect(() => sctx.webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/state',
      handler: async (req, res) => {
        if (req.method !== 'GET') return writeJson(res, 405, { error: 'GET only' });
        const profiles = store.getProfiles();
        const activeId = store.getActiveId();
        const tunnels = tunnelService.listActiveTunnels();
        writeJson(res, 200, { ok: true, profiles, activeId, tunnels });
      }
    }), 'dsh-remote-workspace: /state');

    // 2. POST /dsh-remote-workspace/profiles/save
    sctx.effect(() => sctx.webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/profiles/save',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { error: 'POST only' });
        try {
          const profile = await readBody(req);
          if (!profile.id || !profile.host) {
            return writeJson(res, 400, { ok: false, error: 'ID and Host are required' });
          }
          await store.saveProfile(profile);
          writeJson(res, 200, { ok: true, profile });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /profiles/save');

    // 3. POST /dsh-remote-workspace/profiles/delete
    sctx.effect(() => sctx.webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/profiles/delete',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { error: 'POST only' });
        try {
          const { id } = await readBody(req);
          if (!id) return writeJson(res, 400, { ok: false, error: 'ID is required' });
          await store.deleteProfile(id);
          writeJson(res, 200, { ok: true });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /profiles/delete');

    // 4. POST /dsh-remote-workspace/profiles/active
    sctx.effect(() => sctx.webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/profiles/active',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { error: 'POST only' });
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
    sctx.effect(() => sctx.webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/test',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { error: 'POST only' });
        try {
          const body = await readBody(req);
          const profile = body.profile || (body.id ? store.getProfile(body.id) : body);
          if (!profile || !profile.host) {
            return writeJson(res, 400, { ok: false, error: 'Invalid profile configuration' });
          }
          const result = await sshService.testConnection(profile);
          writeJson(res, 200, { ok: result.success, ...result });
        } catch (err) {
          writeJson(res, 200, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /test');

    // 6. POST /dsh-remote-workspace/browse
    sctx.effect(() => sctx.webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/browse',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { error: 'POST only' });
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
    sctx.effect(() => sctx.webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/sync',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { error: 'POST only' });
        try {
          const { profileId, direction } = await readBody(req);
          const profile = store.getProfile(profileId) || store.getActiveProfile();
          if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
          if (!profile.remoteWorkspace || !profile.localMirrorPath) {
            return writeJson(res, 400, { ok: false, error: 'Both remoteWorkspace and localMirrorPath must be set' });
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
  });
}
