import http from 'node:http';
import { writeJson, readBody, authorizeRequest } from './helpers.js';

export function registerTunnelRoutes(sctx, webServer, { tunnelService, store }) {
  // 18. POST /dsh-remote-workspace/tunnels/start
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/tunnels/start',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
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
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /tunnels/start');

  // POST /dsh-remote-workspace/tunnels/open (#127)
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/tunnels/open',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const { profileId, remotePort, localPort, targetHost } = await readBody(req);
        const profile = (profileId ? store.getProfile(profileId) : null) || store.getActiveProfile();
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });

        const rPort = parseInt(remotePort, 10);
        if (!rPort || isNaN(rPort) || rPort <= 0) {
          return writeJson(res, 400, { ok: false, error: 'Valid remotePort required' });
        }

        const result = await tunnelService.openTunnel(profile, rPort, localPort || 0, targetHost || '127.0.0.1');
        writeJson(res, 200, { ok: true, ...result });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /tunnels/open');

  // 19. POST /dsh-remote-workspace/tunnels/stop
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/tunnels/stop',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const { tunnelId } = await readBody(req);
        if (!tunnelId) return writeJson(res, 400, { ok: false, error: 'tunnelId required' });
        const stopped = tunnelService.stopTunnel(tunnelId);
        writeJson(res, 200, { ok: stopped });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /tunnels/stop');

  // POST /dsh-remote-workspace/tunnels/close (#127)
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/tunnels/close',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const { tunnelId } = await readBody(req);
        if (!tunnelId) return writeJson(res, 400, { ok: false, error: 'tunnelId required' });
        const stopped = tunnelService.stopTunnel(tunnelId);
        writeJson(res, 200, { ok: stopped });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /tunnels/close');

  // GET /dsh-remote-workspace/tunnels (#127)
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/tunnels',
    handler: async (req, res) => {
      if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        writeJson(res, 200, { ok: true, tunnels: tunnelService.listActiveTunnels() });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /tunnels');

  // 20. GET /dsh-remote-workspace/tunnels/telemetry
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/tunnels/telemetry',
    handler: async (req, res) => {
      if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        writeJson(res, 200, { ok: true, tunnels: tunnelService.listActiveTunnels() });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /tunnels/telemetry');

  // HTTP Proxy for tunnels: /dsh-remote-workspace/tunnel/* (#127)
  sctx.effect(() => webServer.register({
    kind: 'prefix',
    path: '/dsh-remote-workspace/tunnel/',
    handler: async (req, res) => {
      if (!authorizeRequest(sctx, req, res)) return;
      const url = new URL(req.url || '/', 'http://localhost');
      const subpath = url.pathname.slice('/dsh-remote-workspace/tunnel/'.length);
      const slashIdx = subpath.indexOf('/');
      const rawTunnelId = slashIdx === -1 ? subpath : subpath.slice(0, slashIdx);
      const targetSubpath = slashIdx === -1 ? '/' : subpath.slice(slashIdx);

      const tunnelId = decodeURIComponent(rawTunnelId);
      const tunnel = tunnelService.activeTunnels.get(tunnelId);
      if (!tunnel) {
        return writeJson(res, 404, { ok: false, error: `Tunnel "${tunnelId}" not found or inactive` });
      }

      const proxyReq = http.request({
        host: '127.0.0.1',
        port: tunnel.localPort,
        method: req.method,
        path: targetSubpath + (url.search || ''),
        headers: {
          ...req.headers,
          host: `127.0.0.1:${tunnel.localPort}`,
          'x-forwarded-for': req.socket?.remoteAddress || '127.0.0.1',
          'x-forwarded-proto': 'http',
        }
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        if (!res.headersSent) {
          writeJson(res, 502, { ok: false, error: `Tunnel proxy error: ${err.message}` });
        }
      });

      req.pipe(proxyReq);
    }
  }), 'dsh-remote-workspace: /tunnel/*');
}
