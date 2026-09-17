import { writeJson, readBody, isTrustedSettingsRequest } from './helpers.js';

export function registerEnvRoutes(sctx, webServer, { envService, diagnoseService, sshService, store }) {
  // 10. POST /dsh-remote-workspace/env/view
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/env/view',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
      try {
        const { profileId, remotePath } = await readBody(req);
        const profile = store.getProfile(profileId);
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
        const result = await envService.readRemoteEnv(sshService, profile, remotePath);
        writeJson(res, 200, { ok: true, ...result });
      } catch (err) {
        writeJson(res, 500, { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /env/view');

  // 11. POST /dsh-remote-workspace/env/save
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/env/save',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
      try {
        const { profileId, remotePath, content } = await readBody(req);
        const profile = store.getProfile(profileId);
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
        const result = await envService.saveRemoteEnv(sshService, profile, remotePath, content);
        writeJson(res, 200, { ok: true, ...result });
      } catch (err) {
        writeJson(res, 500, { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /env/save');

  // 12. POST /dsh-remote-workspace/diagnose
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/diagnose',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
      try {
        const { profileId, checks } = await readBody(req);
        const profile = store.getProfile(profileId);
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
        const results = await diagnoseService.diagnose(sshService, profile, checks);
        writeJson(res, 200, { ok: true, results });
      } catch (err) {
        writeJson(res, 500, { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /diagnose');
}
