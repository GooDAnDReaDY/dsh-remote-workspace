import { writeJson, readBody, isTrustedSettingsRequest } from './helpers.js';

export function registerTunnelRoutes(sctx, webServer, { tunnelService, store }) {
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
      if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
      try {
        writeJson(res, 200, { ok: true, tunnels: tunnelService.listActiveTunnels() });
      } catch (err) {
        writeJson(res, 500, { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /tunnels/telemetry');
}
