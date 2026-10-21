import { writeJson, readBody, authorizeRequest, validateRemotePath } from './helpers.js';

export function registerSearchRoutes(sctx, webServer, { store, sshService }) {
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/search',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const body = await readBody(req);
        const profileId = body.profileId;
        const profile = profileId ? store.getProfile(profileId) : store.getActiveProfile();
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });

        const query = body.query;
        if (!query || typeof query !== 'string' || !query.trim()) {
          return writeJson(res, 400, { ok: false, error: 'query is required' });
        }

        const rawPath = body.path || profile.remoteWorkspace || '.';
        const searchPath = validateRemotePath(rawPath);
        const isRegex = Boolean(body.isRegex);
        const maxResults = typeof body.maxResults === 'number' && body.maxResults > 0 ? Math.min(body.maxResults, 200) : 50;
        const filePattern = typeof body.filePattern === 'string' && body.filePattern.trim() ? body.filePattern.trim() : null;

        const result = await sshService.searchCodebase(profile, {
          query: query.trim(),
          isRegex,
          path: searchPath,
          maxResults,
          filePattern,
        });

        writeJson(res, 200, { ok: true, ...result });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), {
          ok: false,
          error: err.message,
        });
      }
    }
  }), 'dsh-remote-workspace: /search');
}
