import { SshConfigParser } from './ssh-config-parser.js';

export function registerApiRoutes(ctx, sshService, remoteFs, mirrorSync, tunnelService, store, dockerService, healthService, watcherService, diagnoseService, envService, tarSyncService, alertService) {
  function writeJson(res, statusCode, body) {
    if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.statusCode = statusCode;
    } else if (typeof res.writeHead === 'function') {
      res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    } else {
      res.statusCode = statusCode;
    }
    res.end(JSON.stringify(body));
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (err) {
          reject(err);
        }
      });
      req.on('error', reject);
    });
  }

  function isTrustedSettingsRequest(req) {
    const rawAuth = req.headers['authorization'];
    if (typeof rawAuth === 'string' && rawAuth.startsWith('Bearer ')) return true;
    const cookieHeader = req.headers['cookie'];
    if (typeof cookieHeader === 'string' && (cookieHeader.includes('token=') || cookieHeader.includes('dsh_token='))) {
      return true;
    }
    const secFetch = req.headers['sec-fetch-site'];
    if (secFetch === 'same-origin') return true;
    const ip = req.socket?.remoteAddress || '';
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true;
    return false;
  }

  ctx.inject(['webServer'], (sctx) => {
    const webServer = sctx.get ? (sctx.get('webServer') ?? sctx.webServer) : sctx.webServer;
    if (!webServer || typeof webServer.register !== 'function') return;

    // 1. GET /dsh-remote-workspace/state
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/state',
      handler: async (req, res) => {
        if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET only' });
        try {
          const profiles = store.getProfiles();
          const activeId = store.getActiveId() || (profiles[0]?.id || '');
          const tunnels = tunnelService.listActiveTunnels();
          const autoSync = store.isAutoSyncEnabled ? store.isAutoSyncEnabled() : false;
          const alerts = alertService ? alertService.getAlerts() : [];
          writeJson(res, 200, {
            ok: true,
            profiles,
            activeId,
            tunnels,
            autoSync,
            alerts,
            vaultProtected: true
          });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
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
          const sanitized = store.vault ? store.vault.sanitizeProfile(profile) : profile;
          writeJson(res, 200, { ok: true, profile: sanitized });
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

    // 5. POST /dsh-remote-workspace/profiles/import-ssh-config (New in v0.3.1)
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/profiles/import-ssh-config',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const { text } = await readBody(req);
          const rawText = text || SshConfigParser.readDefaultConfig();
          if (!rawText) {
            return writeJson(res, 400, { ok: false, error: 'No SSH config text provided and ~/.ssh/config not found' });
          }
          const imported = SshConfigParser.parse(rawText);
          const saved = [];
          for (const p of imported) {
            await store.saveProfile(p);
            saved.push(store.vault ? store.vault.sanitizeProfile(p) : p);
          }
          writeJson(res, 200, { ok: true, count: saved.length, profiles: saved });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /profiles/import-ssh-config');

    // 6. POST /dsh-remote-workspace/test
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/test',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const body = await readBody(req);
          let profile = body.profile || (body.id ? store.getProfile(body.id) : body);
          if (store.vault && profile) {
            profile = store.vault.hydrateProfile(profile);
          }
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

    // 7. POST /dsh-remote-workspace/browse
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
          const entries = await remoteFs.listDir(profile, remotePath, Boolean(body.refresh));
          writeJson(res, 200, { ok: true, currentPath: remotePath, entries });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /browse');

    // 8. POST /dsh-remote-workspace/file/view
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/file/view',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const { profileId, filePath } = await readBody(req);
          const profile = (profileId ? store.getProfile(profileId) : null) || store.getActiveProfile();
          if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
          if (!filePath) return writeJson(res, 400, { ok: false, error: 'filePath required' });

          const stat = await remoteFs.stat(profile, filePath);
          if (stat.size > 1024 * 512) {
            return writeJson(res, 400, { ok: false, error: `File too large for preview (${Math.round(stat.size / 1024)} KB). Max 512 KB.` });
          }

          const content = await remoteFs.readFile(profile, filePath, 'utf8');
          writeJson(res, 200, { ok: true, filePath, content, size: stat.size, mtime: stat.mtime });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /file/view');

    // 9. POST /dsh-remote-workspace/file/save
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/file/save',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const { profileId, filePath, content } = await readBody(req);
          const profile = (profileId ? store.getProfile(profileId) : null) || store.getActiveProfile();
          if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
          if (!filePath || content === undefined) return writeJson(res, 400, { ok: false, error: 'filePath and content required' });

          const result = await remoteFs.writeFile(profile, filePath, content, 'utf8');
          writeJson(res, 200, { ok: true, ...result });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /file/save');

    // 10. POST /dsh-remote-workspace/env/view (New in v0.3.1)
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/env/view',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const { profileId, filePath } = await readBody(req);
          const profile = (profileId ? store.getProfile(profileId) : null) || store.getActiveProfile();
          if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
          if (!envService) return writeJson(res, 500, { ok: false, error: 'EnvService unavailable' });

          const target = filePath || (profile.remoteWorkspace ? `${profile.remoteWorkspace}/.env` : '.env');
          const data = await envService.readEnv(profile, target);
          writeJson(res, 200, { ok: true, ...data });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /env/view');

    // 11. POST /dsh-remote-workspace/env/save (New in v0.3.1)
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/env/save',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const { profileId, filePath, key, value } = await readBody(req);
          const profile = (profileId ? store.getProfile(profileId) : null) || store.getActiveProfile();
          if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
          if (!key) return writeJson(res, 400, { ok: false, error: 'key is required' });
          if (!envService) return writeJson(res, 500, { ok: false, error: 'EnvService unavailable' });

          const target = filePath || (profile.remoteWorkspace ? `${profile.remoteWorkspace}/.env` : '.env');
          const result = await envService.setEnvVar(profile, target, key, value || '');
          writeJson(res, 200, { ok: true, ...result });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /env/save');

    // 12. POST /dsh-remote-workspace/diagnose (New in v0.3.1)
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/diagnose',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const { profileId, category, target } = await readBody(req);
          const profile = (profileId ? store.getProfile(profileId) : null) || store.getActiveProfile();
          if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
          if (!category) return writeJson(res, 400, { ok: false, error: 'category is required' });
          if (!diagnoseService) return writeJson(res, 500, { ok: false, error: 'DiagnoseService unavailable' });

          const result = await diagnoseService.diagnose(profile, category, target);
          writeJson(res, 200, { ok: true, ...result });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /diagnose');

    // 13. POST /dsh-remote-workspace/terminal/create
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/terminal/create',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const { profileId, cols, rows } = await readBody(req);
          const profile = (profileId ? store.getProfile(profileId) : null) || store.getActiveProfile();
          if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });

          const session = await sshService.createTerminalSession(profile, { cols, rows });
          writeJson(res, 200, { ok: true, sessionId: session.id });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /terminal/create');

    // 14. POST /dsh-remote-workspace/terminal/input
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/terminal/input',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const { sessionId, data } = await readBody(req);
          const session = sshService.getTerminalSession(sessionId);
          if (!session) return writeJson(res, 404, { ok: false, error: 'Terminal session not found' });
          session.write(data || '');
          writeJson(res, 200, { ok: true });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /terminal/input');

    // 15. GET /dsh-remote-workspace/terminal/stream (SSE)
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/terminal/stream',
      handler: async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const sessionId = url.searchParams.get('sessionId');
        const session = sshService.getTerminalSession(sessionId);
        if (!session) return writeJson(res, 404, { ok: false, error: 'Terminal session not found' });

        if (typeof res.writeHead === 'function') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive'
          });
        }

        for (const chunk of session.buffer) {
          res.write(`data: ${JSON.stringify({ chunk })}\\n\\n`);
        }

        const listener = (chunk) => {
          res.write(`data: ${JSON.stringify({ chunk })}\\n\\n`);
        };
        session.subscribers.add(listener);

        req.on('close', () => {
          session.subscribers.delete(listener);
        });
      }
    }), 'dsh-remote-workspace: /terminal/stream');

    // 16. POST /dsh-remote-workspace/terminal/close
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/terminal/close',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const { sessionId } = await readBody(req);
          const ok = sshService.closeTerminalSession(sessionId);
          writeJson(res, 200, { ok });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /terminal/close');

    // 17. POST /dsh-remote-workspace/sync
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/sync',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const { profileId, direction, force, mode } = await readBody(req);
          const profile = (profileId ? store.getProfile(profileId) : null) || store.getActiveProfile();
          if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
          if (!profile.remoteWorkspace || !profile.localMirrorPath) {
            return writeJson(res, 400, { ok: false, error: 'Both remoteWorkspace and localMirrorPath must be configured' });
          }

          if (mode === 'tarball' && tarSyncService) {
            const resTar = direction === 'push'
              ? await tarSyncService.pushTar(profile, profile.localMirrorPath, profile.remoteWorkspace)
              : await tarSyncService.pullTar(profile, profile.remoteWorkspace, profile.localMirrorPath);
            return writeJson(res, 200, { ok: true, ...resTar });
          }

          const resSync = direction === 'push'
            ? await mirrorSync.push(profile, profile.localMirrorPath, profile.remoteWorkspace, Boolean(force))
            : await mirrorSync.pull(profile, profile.remoteWorkspace, profile.localMirrorPath);
          writeJson(res, 200, { ok: resSync.success, ...resSync });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /sync');

    // 18. POST /dsh-remote-workspace/tunnels/start
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

    // 19. POST /dsh-remote-workspace/tunnels/stop
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

    // 20. GET /dsh-remote-workspace/tunnels/telemetry
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/tunnels/telemetry',
      handler: async (req, res) => {
        if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET only' });
        try {
          writeJson(res, 200, { ok: true, tunnels: tunnelService.listActiveTunnels() });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /tunnels/telemetry');

    // 21. GET /dsh-remote-workspace/health
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/health',
      handler: async (req, res) => {
        if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET only' });
        try {
          const url = new URL(req.url, 'http://localhost');
          const profileId = url.searchParams.get('profileId');
          const profile = profileId ? store.getProfile(profileId) : store.getActiveProfile();
          if (!profile) return writeJson(res, 404, { ok: false, error: 'No active profile' });

          const health = await healthService.getHealth(profile);
          writeJson(res, 200, { ok: true, health });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /health');

    // 22. GET /dsh-remote-workspace/docker/list
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/docker/list',
      handler: async (req, res) => {
        if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET only' });
        try {
          const url = new URL(req.url, 'http://localhost');
          const profileId = url.searchParams.get('profileId');
          const profile = profileId ? store.getProfile(profileId) : store.getActiveProfile();
          if (!profile) return writeJson(res, 404, { ok: false, error: 'No active profile' });

          const result = await dockerService.listContainers(profile, true);
          writeJson(res, 200, { ok: true, ...result });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /docker/list');

    // 23. POST /dsh-remote-workspace/docker/action
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/docker/action',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const { profileId, containerId, action } = await readBody(req);
          const profile = profileId ? store.getProfile(profileId) : store.getActiveProfile();
          if (!profile) return writeJson(res, 404, { ok: false, error: 'No active profile' });
          if (!containerId || !action) return writeJson(res, 400, { ok: false, error: 'containerId and action required' });

          const result = await dockerService.containerAction(profile, containerId, action);
          writeJson(res, 200, { ok: result.success, ...result });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /docker/action');

    // 24. POST /dsh-remote-workspace/docker/logs
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/docker/logs',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const { profileId, containerId, tail } = await readBody(req);
          const profile = profileId ? store.getProfile(profileId) : store.getActiveProfile();
          if (!profile) return writeJson(res, 404, { ok: false, error: 'No active profile' });
          if (!containerId) return writeJson(res, 400, { ok: false, error: 'containerId required' });

          const result = await dockerService.containerLogs(profile, containerId, tail || 100);
          writeJson(res, 200, { ok: result.success, ...result });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /docker/logs');

    // 25. POST /dsh-remote-workspace/watcher/toggle
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/watcher/toggle',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const { enabled } = await readBody(req);
          await store.setAutoSyncEnabled(Boolean(enabled));
          writeJson(res, 200, { ok: true, autoSync: store.isAutoSyncEnabled() });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /watcher/toggle');

    // 26. POST /dsh-remote-workspace/transfer
    sctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/dsh-remote-workspace/transfer',
      handler: async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
        if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
        try {
          const { sourceProfileId, sourcePath, destProfileId, destPath } = await readBody(req);
          const srcProfile = sourceProfileId ? store.getProfile(sourceProfileId) : store.getActiveProfile();
          const destProfile = store.getProfile(destProfileId);

          if (!srcProfile) return writeJson(res, 404, { ok: false, error: 'Source profile not found' });
          if (!destProfile) return writeJson(res, 404, { ok: false, error: 'Destination profile not found' });
          if (!sourcePath || !destPath) return writeJson(res, 400, { ok: false, error: 'sourcePath and destPath required' });

          const result = await sshService.transferFileBetweenHosts(srcProfile, sourcePath, destProfile, destPath);
          writeJson(res, 200, { ok: result.success, ...result });
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err.message });
        }
      }
    }), 'dsh-remote-workspace: /transfer');
  });
}
