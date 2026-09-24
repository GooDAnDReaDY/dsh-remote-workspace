import { writeJson, readBody, isTrustedSettingsRequest } from './helpers.js';

export function registerDockerRoutes(sctx, webServer, { dockerService, healthService, store }) {
  // 21. GET /dsh-remote-workspace/health
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/health',
    handler: async (req, res) => {
      if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET only' });
      if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
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
      if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
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
}
