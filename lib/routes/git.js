import { writeJson, readBody, authorizeRequest, validateRemotePath } from './helpers.js';

export function registerGitRoutes(sctx, webServer, { gitService, store }) {
  // GET & POST /dsh-remote-workspace/git/status (#129)
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/git/status',
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'POST') {
        return writeJson(res, 405, { ok: false, error: 'GET or POST only' });
      }
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        let profileId = null;
        let rawPath = null;

        if (req.method === 'POST') {
          const body = await readBody(req);
          profileId = body.profileId;
          rawPath = body.path || body.workspacePath;
        } else {
          const url = new URL(req.url, 'http://localhost');
          profileId = url.searchParams.get('profileId');
          rawPath = url.searchParams.get('path');
        }

        const profile = (profileId ? store.getProfile(profileId) : null) || store.getActiveProfile();
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });

        const targetPath = rawPath ? validateRemotePath(rawPath) : profile.remoteWorkspace;
        const result = await gitService.getStatus(profile, targetPath);
        writeJson(res, 200, { ok: true, ...result });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /git/status');
}
