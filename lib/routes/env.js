import { writeJson, readBody, authorizeRequest } from './helpers.js';

export function registerEnvRoutes(sctx, webServer, { envService, diagnoseService, sshService, store, remoteFs }) {
  // 10. POST /dsh-remote-workspace/env/view
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/env/view',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const { profileId, remotePath } = await readBody(req);
        const profile = store.getProfile(profileId);
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
        const targetPath = remotePath || (profile.remoteWorkspace ? `${profile.remoteWorkspace.replace(/\/+$/, '')}/.env` : '.env');
        const result = await envService.readEnv(profile, targetPath);
        writeJson(res, 200, { ok: true, ...result });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /env/view');

  // 11. POST /dsh-remote-workspace/env/save
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/env/save',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const { profileId, remotePath, content, key, value } = await readBody(req);
        const profile = store.getProfile(profileId);
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
        const targetPath = remotePath || (profile.remoteWorkspace ? `${profile.remoteWorkspace.replace(/\/+$/, '')}/.env` : '.env');
        let result;
        if (key) {
          result = await envService.setEnvVar(profile, targetPath, key, value || '');
        } else if (content !== undefined) {
          if (remoteFs && typeof remoteFs.writeFile === 'function') {
            await remoteFs.writeFile(profile, targetPath, content);
          }
          result = { ok: true, filePath: targetPath };
        } else {
          return writeJson(res, 400, { ok: false, error: 'Either key/value or content is required' });
        }
        writeJson(res, 200, { ok: true, ...result });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /env/save');

  // 12. POST /dsh-remote-workspace/diagnose
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/diagnose',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const { profileId, category, checks, target } = await readBody(req);
        const profile = store.getProfile(profileId);
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
        const checkCategory = category || checks || 'memory';
        const result = await diagnoseService.diagnose(profile, checkCategory, target || '');
        writeJson(res, 200, { ok: true, ...result });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /diagnose');
}
