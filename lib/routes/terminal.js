import { writeJson, readBody, isTrustedSettingsRequest } from './helpers.js';
import { normalizeTerminalFont } from '../terminal-font.js';

export function registerTerminalRoutes(sctx, webServer, { sshService, store }) {

  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/terminal/font',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
      try {
        const body = await readBody(req);
        const fontFamily = await store.setTerminalFont(body.fontFamily);
        writeJson(res, 200, { ok: true, terminalFontFamily: fontFamily });
      } catch (err) {
        const status = err.code === 'INVALID_FONT' ? 400 : 500;
        writeJson(res, status, { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /terminal/font');

  // 13. POST /dsh-remote-workspace/terminal/create
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/terminal/create',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
      try {
        const { profileId, cols, rows } = await readBody(req);
        const profile = profileId ? store.getProfile(profileId) : store.getActiveProfile();
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
        const session = await sshService.createTerminalSession(profile, { cols: cols || 80, rows: rows || 24 });
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
        const { sessionId, data, resize } = await readBody(req);
        const session = sshService.getTerminalSession(sessionId);
        if (!session) return writeJson(res, 404, { ok: false, error: 'Session not found' });
        if (resize && typeof resize.cols === 'number' && typeof resize.rows === 'number') {
          session.resize(resize.cols, resize.rows);
        }
        if (typeof data === 'string') {
          session.write(data);
        }
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
      if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET only' });
      if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
      try {
        const url = new URL(req.url, 'http://localhost');
        const sessionId = url.searchParams.get('sessionId');
        const session = sshService.getTerminalSession(sessionId);
        if (!session) return writeJson(res, 404, { ok: false, error: 'Session not found' });

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        });

        if (session.buffer.length > 0) {
          res.write(`data: ${JSON.stringify(session.buffer.join(''))}\n\n`);
        }

        const sub = (chunk) => {
          try {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          } catch (e) {
            session.subscribers.delete(sub);
          }
        };
        session.subscribers.add(sub);

        req.on('close', () => {
          session.subscribers.delete(sub);
        });
      } catch (err) {
        writeJson(res, 500, { ok: false, error: err.message });
      }
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
        sshService.closeTerminalSession(sessionId);
        writeJson(res, 200, { ok: true });
      } catch (err) {
        writeJson(res, 500, { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /terminal/close');
}
