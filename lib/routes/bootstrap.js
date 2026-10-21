import { writeJson, readBody, authorizeRequest } from './helpers.js';

export function registerBootstrapRoutes(sctx, webServer, { bootstrapService, store }) {
  // GET /dsh-remote-workspace/bootstrap/templates
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/bootstrap/templates',
    handler: async (req, res) => {
      if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const templates = bootstrapService.getTemplates();
        writeJson(res, 200, { ok: true, templates });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /bootstrap/templates');

  // POST /dsh-remote-workspace/bootstrap/run
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/bootstrap/run',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const body = await readBody(req);
        const profile = (body.profileId ? store.getProfile(body.profileId) : null) || store.getActiveProfile();
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });

        const result = await bootstrapService.runBootstrap(profile, {
          script: body.script,
          templateId: body.templateId,
          timeout: body.timeout || 300
        });

        writeJson(res, 200, { ok: result.success, ...result });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /bootstrap/run');
}
