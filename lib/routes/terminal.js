import { writeJson, readBody, authorizeRequest } from './helpers.js';
import { normalizeTerminalFont } from '../terminal-font.js';

export function registerTerminalRoutes(sctx, webServer, { sshService, store }) {

  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/terminal/font',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
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
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const { profileId, cols, rows, persistent, sessionName } = await readBody(req);
        const profile = (profileId ? store.getProfile(profileId) : null) || store.getActiveProfile();
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
        const opts = { cols: cols || 80, rows: rows || 24 };
        if (persistent !== undefined) opts.persistent = persistent;
        if (sessionName !== undefined) opts.sessionName = sessionName;
        const session = await sshService.createTerminalSession(profile, opts);
        writeJson(res, 200, { ok: true, sessionId: session.id, sessionName: session.sessionName });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /terminal/create');

  // 13b. GET /dsh-remote-workspace/terminal/sessions (#128)
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/terminal/sessions',
    handler: async (req, res) => {
      if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const url = new URL(req.url, 'http://localhost');
        const profileId = url.searchParams.get('profileId');
        const profile = (profileId ? store.getProfile(profileId) : null) || store.getActiveProfile();
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });

        const remoteSessions = await sshService.listPersistentSessions(profile);
        const inMemorySessions = [];
        if (sshService.terminalSessions && typeof sshService.terminalSessions.entries === 'function') {
          for (const [id, s] of sshService.terminalSessions.entries()) {
            if (s.profileId === profile.id) {
              inMemorySessions.push({
                id,
                sessionName: s.sessionName,
                createdAt: s.createdAt,
                lastActive: s.lastActive
              });
            }
          }
        }

        writeJson(res, 200, {
          ok: true,
          sessions: remoteSessions,
          active: inMemorySessions
        });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /terminal/sessions');

  // 13c. POST /dsh-remote-workspace/terminal/kill (#128)
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/terminal/kill',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const { profileId, sessionName, sessionId } = await readBody(req);
        const profile = (profileId ? store.getProfile(profileId) : null) || store.getActiveProfile();
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });

        let killed = false;
        if (sessionName) {
          killed = await sshService.killPersistentSession(profile, sessionName);
        }
        if (sessionId) {
          sshService.closeTerminalSession(sessionId);
          killed = true;
        }

        writeJson(res, 200, { ok: true, killed });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /terminal/kill');

  // 14. POST /dsh-remote-workspace/terminal/input
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/terminal/input',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
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
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /terminal/input');

  // 15. GET /dsh-remote-workspace/terminal/stream (SSE)
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/terminal/stream',
    handler: async (req, res) => {
      if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET only' });
      if (!authorizeRequest(sctx, req, res)) return;
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
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /terminal/stream');

  // 16. POST /dsh-remote-workspace/terminal/close
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/terminal/close',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const { sessionId } = await readBody(req);
        sshService.closeTerminalSession(sessionId);
        writeJson(res, 200, { ok: true });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /terminal/close');
}
