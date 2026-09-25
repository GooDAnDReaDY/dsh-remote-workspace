import { writeJson, readBody, isTrustedSettingsRequest, authorizeRequest } from './helpers.js';

export function registerSyncRoutes(sctx, webServer, { mirrorSync, tarSyncService, watcherService, store }) {
  // 17. POST /dsh-remote-workspace/sync
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/sync',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
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
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /sync');

  // 25. POST /dsh-remote-workspace/watcher/toggle
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/watcher/toggle',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const { enabled } = await readBody(req);
        await store.setAutoSyncEnabled(Boolean(enabled));
        writeJson(res, 200, { ok: true, autoSync: store.isAutoSyncEnabled() });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /watcher/toggle');
}
