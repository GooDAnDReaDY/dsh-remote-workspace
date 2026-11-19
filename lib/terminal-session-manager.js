/**
 * Interactive terminal session registry (#173): extracted from SshService so
 * the connection service stays under the size budget. Owns the session map
 * and every lifecycle path (create, write, resize, close, tmux persistence,
 * abandoned-session sweep).
 */
export class TerminalSessionManager {
  /**
   * @param {{ connectDedicated: Function, exec: Function }} deps
   */
  constructor({ connectDedicated, exec }) {
    /** @type {Map<string, any>} */
    this.sessions = new Map();
    this.connectDedicated = connectDedicated;
    this.exec = exec;
  }

  async create(profile, options = {}) {
    if (typeof options === 'number') {
      options = { cols: options, rows: arguments[2] };
    }
    const conn = await this.connectDedicated(profile);
    const cols = options.cols || 80;
    const rows = options.rows || 24;
    const term = options.term || 'xterm-256color';
    const sessionId = options.sessionId || `term_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const sessionName = options.sessionName || (options.persistent ? `dsh-${profile.id || 'default'}-main` : null);

    return new Promise((resolve, reject) => {
      const handleStream = (err, stream) => {
        if (err) return reject(err);

        const session = {
          id: sessionId,
          sessionName,
          profileId: profile.id,
          stream,
          createdAt: Date.now(),
          lastActive: Date.now(),
          buffer: [],
          subscribers: new Set(),
          write(data) {
            session.lastActive = Date.now();
            try { stream.write(data); } catch (err) { session.status = 'disconnected'; const lost = '\r\n\x1b[31m[Connection lost]\x1b[0m\r\n'; session.buffer.push(lost); for (const sub of session.subscribers) { try { sub(lost); } catch (e) { /* best-effort notify */ } } }
          },
          resize(c, r) {
            session.lastActive = Date.now();
            try { stream.setWindow(r, c, 0, 0); } catch (err) { /* best-effort cleanup */ }
          },
          close() {
            if (session.closed) return;
            session.closed = true;
            try { stream.end(); } catch (err) { /* best-effort cleanup */ }
            try { conn.end(); } catch (err) { /* best-effort cleanup */ }
          }
        };

        stream.on('data', (d) => {
          session.lastActive = Date.now();
          const chunk = d.toString('utf8');
          session.buffer.push(chunk);
          if (session.buffer.length > 500) session.buffer.shift();
          for (const sub of session.subscribers) {
            try { sub(chunk); } catch (err) { /* best-effort cleanup */ }
          }
        });

        stream.on('close', () => {
          session.close();
          this.sessions.delete(sessionId);
        });

        this.sessions.set(sessionId, session);
        resolve(session);
      };

      if (sessionName && typeof conn.exec === 'function') {
        const sanitized = sessionName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const cmd = `command -v tmux >/dev/null 2>&1 && exec tmux new-session -A -s ${sanitized} || exec $SHELL -l || exec bash -l || exec sh -l`;
        conn.exec(cmd, { pty: { term, cols, rows } }, (err, stream) => {
          if (err) {
            conn.shell({ term, cols, rows }, handleStream);
          } else {
            handleStream(null, stream);
          }
        });
      } else {
        conn.shell({ term, cols, rows }, handleStream);
      }
    });
  }

  get(sessionId) {
    return this.sessions.get(sessionId);
  }

  close(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.close();
      this.sessions.delete(sessionId);
      return true;
    }
    return false;
  }

  async listPersistent(profile) {
    if (!profile) return [];
    try {
      const res = await this.exec(profile, 'command -v tmux >/dev/null 2>&1 && tmux list-sessions -F "#{session_name}:#{session_windows}:#{session_created}:#{session_attached}" 2>/dev/null || true');
      if (res.code !== 0 || !res.stdout.trim()) {
        return [];
      }
      const prefix = `dsh-${profile.id}-`;
      const lines = res.stdout.trim().split(/\r?\n/);
      const sessions = [];
      for (const line of lines) {
        const parts = line.trim().split(':');
        if (parts.length < 4) continue;
        const [name, windows, created, attached] = parts;
        if (name.startsWith(prefix) || name.startsWith('dsh-')) {
          sessions.push({
            name,
            windows: parseInt(windows, 10) || 1,
            created: (parseInt(created, 10) || 0) * 1000 || Date.now(),
            attached: attached === '1'
          });
        }
      }
      return sessions;
    } catch (_) {
      return [];
    }
  }

  async killPersistent(profile, sessionName) {
    if (!profile || !sessionName) return false;
    const sanitized = sessionName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const res = await this.exec(profile, `tmux kill-session -t ${sanitized} 2>/dev/null || true`);
    for (const [id, s] of this.sessions.entries()) {
      if (s.profileId === profile.id && s.sessionName === sessionName) {
        s.close();
        this.sessions.delete(id);
      }
    }
    return res.code === 0;
  }

  sweepAbandoned(now = Date.now(), idleTimeoutMs = 10 * 60 * 1000) {
    const closed = [];
    for (const [id, session] of this.sessions.entries()) {
      const hasSubscribers = session.subscribers && session.subscribers.size > 0;
      const lastActive = session.lastActive || session.createdAt || now;
      if (!hasSubscribers && (now - lastActive >= idleTimeoutMs)) {
        try { session.close(); } catch (err) { /* best-effort cleanup */ }
        this.sessions.delete(id);
        closed.push(id);
      }
    }
    return closed;
  }

  closeAll() {
    for (const [, term] of this.sessions.entries()) {
      try { term.close(); } catch (err) { /* best-effort cleanup */ }
    }
    this.sessions.clear();
  }
}
