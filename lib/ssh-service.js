import { Client } from 'ssh2';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { expandProxyCommand, openProxyCommand } from './proxy-command.js';
import { openJumpChain, resolveJumpHops } from './jump-chain.js';
import { resolveAgentEndpoint } from './agent-endpoint.js';
import { runWithReconnect } from './exec-retry.js';

/**
 * Utility to strip ANSI escape sequences from terminal output for clean LLM ingestion
 */
export function stripAnsi(str) {
  if (!str) return '';
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

export class SshService {
  /**
   * @param {any} ctx
   * @param {import('./vault-service.js').VaultService} [vaultService]
   */
  constructor(ctx, vaultService = null) {
    this.ctx = ctx;
    this.vaultService = vaultService;
    /** @type {Map<string, Client>} */
    this.connections = new Map();
    /** @type {Map<string, any>} */
    this.sftpSessions = new Map();
    /** @type {Map<string, any>} */
    this.terminalSessions = new Map();
    /** @type {Map<string, { view: any, finish: Function, timer: NodeJS.Timeout }>} */
    this.authPrompts = new Map();
    /** @type {Map<string, { lastUsed: number, inFlight: number, pinned: boolean }>} */
    this.connMeta = new Map();
    this.idleTimeoutMs = 30 * 60 * 1000;
    this.getJumpProfile = null;
  }

  setVaultService(vault) {
    this.vaultService = vault;
  }

  setProfileResolver(resolver) {
    this.profileResolver = resolver;
  }

  async execById(profileId, command, cwd = null, onData = null) {
    if (typeof this.profileResolver !== 'function') {
      throw new Error('Profile resolver not configured on SshService');
    }
    const profile = this.profileResolver(profileId);
    if (!profile) {
      throw new Error(`Remote profile "${profileId}" not found`);
    }
    return this.exec(profile, command, cwd, onData);
  }

  setJumpProfileResolver(resolver) {
    this.getJumpProfile = resolver;
  }


  touch(profileId) {
    if (!profileId) return;
    const meta = this.connMeta.get(profileId) || { lastUsed: 0, inFlight: 0, pinned: false };
    meta.lastUsed = Date.now();
    this.connMeta.set(profileId, meta);
  }

  bumpInFlight(profileId, delta) {
    if (!profileId) return;
    const meta = this.connMeta.get(profileId) || { lastUsed: Date.now(), inFlight: 0, pinned: false };
    meta.inFlight = Math.max(0, (meta.inFlight || 0) + delta);
    meta.lastUsed = Date.now();
    this.connMeta.set(profileId, meta);
  }

  setPinned(profileId, pinned) {
    if (!profileId) return;
    const meta = this.connMeta.get(profileId) || { lastUsed: Date.now(), inFlight: 0, pinned: false };
    meta.pinned = Boolean(pinned);
    this.connMeta.set(profileId, meta);
  }

  sweepIdle(now = Date.now()) {
    const closed = [];
    for (const [id] of this.connections) {
      const meta = this.connMeta.get(id) || { lastUsed: now, inFlight: 0, pinned: false };
      if (meta.pinned || meta.inFlight > 0) continue;
      if (now - meta.lastUsed < this.idleTimeoutMs) continue;
      this.disconnect(id);
      this.connMeta.delete(id);
      closed.push(id);
    }
    this.sweepAbandonedTerminalSessions(now);
    return closed;
  }

  sweepAbandonedTerminalSessions(now = Date.now(), idleTimeoutMs = 10 * 60 * 1000) {
    const closed = [];
    for (const [id, session] of this.terminalSessions.entries()) {
      const hasSubscribers = session.subscribers && session.subscribers.size > 0;
      const lastActive = session.lastActive || session.createdAt || now;
      if (!hasSubscribers && (now - lastActive >= idleTimeoutMs)) {
        try { session.close(); } catch (err) { /* best-effort cleanup */ }
        this.terminalSessions.delete(id);
        closed.push(id);
      }
    }
    return closed;
  }

  connectDedicated(profile, sock) {
    const hydrated = this.vaultService ? this.vaultService.hydrateProfile(profile) : profile;
    return this._dial(hydrated, sock, null, false);
  }

  beginKeyboardPrompt(profileId, view, finish, timeoutMs = 60000) {
    const id = profileId || '';
    this.clearKeyboardPrompt(id);
    const timer = setTimeout(() => {
      if (!this.authPrompts.has(id)) return;
      this.authPrompts.delete(id);
      try { finish([]); } catch { /* the attempt already ended */ }
    }, timeoutMs);
    timer.unref?.();
    this.authPrompts.set(id, { view, finish, timer });
  }

  listKeyboardPrompts() {
    return [...this.authPrompts.entries()].map(([profileId, pending]) => ({
      profileId,
      instructions: pending.view.instructions,
      prompts: pending.view.prompts
    }));
  }

  submitKeyboardPrompt(profileId, answers) {
    const pending = this.authPrompts.get(profileId || '');
    if (!pending) return false;
    clearTimeout(pending.timer);
    this.authPrompts.delete(profileId || '');
    const values = Array.isArray(answers) ? answers.map((item) => String(item ?? '')) : [];
    pending.finish(values);
    return true;
  }

  clearKeyboardPrompt(profileId) {
    const pending = this.authPrompts.get(profileId || '');
    if (!pending) return;
    clearTimeout(pending.timer);
    this.authPrompts.delete(profileId || '');
  }



  resolvePrivateKey(profile) {
    if (profile.privateKey && profile.privateKey.trim()) {
      return profile.privateKey;
    }
    if (profile.privateKeyPath) {
      let resolvedPath = profile.privateKeyPath.trim();
      if (resolvedPath.startsWith('~')) {
        resolvedPath = path.join(os.homedir(), resolvedPath.slice(1));
      }
      try {
        if (fs.existsSync(resolvedPath)) {
          return fs.readFileSync(resolvedPath, 'utf8');
        }
      } catch (err) { /* best-effort cleanup */ }
    }
    return undefined;
  }

  /**
   * Connect to remote machine with pooling, keep-alive, auto-reconnect and ProxyJump
   */
  async getConnection(rawProfile) {
    const profile = this.vaultService ? this.vaultService.hydrateProfile(rawProfile) : rawProfile;
    const connId = profile.id;

    const existing = this.connections.get(connId);
    if (existing && existing._sock && !existing._sock.destroyed) {
      this.touch(connId);
      return existing;
    }

    this.connections.delete(connId);
    this.sftpSessions.delete(connId);

    // ProxyCommand replaces a direct TCP socket. A jump host is used only when no command is set.
    let sock = undefined;
    let releaseTransport = null;
    const proxyCommand = typeof profile.proxyCommand === 'string' ? profile.proxyCommand.trim() : '';
    if (proxyCommand) {
      const expanded = expandProxyCommand(proxyCommand, {
        host: profile.host,
        port: profile.port || 22,
        user: profile.username || 'root',
        alias: profile.name || profile.id || ''
      });
      const opened = openProxyCommand(expanded);
      sock = opened.sock;
      releaseTransport = opened.stop;
    } else {
      const hopIds = resolveJumpHops(profile);
      if (hopIds.length && this.getJumpProfile) {
        const hopProfiles = hopIds.map((id) => {
          const hop = this.getJumpProfile(id);
          if (!hop) throw new Error(`Jump host "${id}" was not found`);
          return hop;
        });
        const opened = await openJumpChain(profile, hopProfiles, {
          connectPooled: (hop) => this.getConnection(hop),
          connectDedicated: (hop, stream) => this.connectDedicated(hop, stream)
        });
        sock = opened.sock;
        releaseTransport = opened.release;
      }
    }

    return this._dial(profile, sock, releaseTransport, true);
  }

  _dial(profile, sock, releaseTransport, pool) {
    const connId = profile.id;
    return new Promise((resolve, reject) => {
      const conn = new Client();
      const connConfig = {
        host: profile.host,
        port: profile.port || 22,
        username: profile.username || 'root',
        keepaliveInterval: 15000,
        keepaliveCountMax: 3,
        readyTimeout: 20000,
        tryKeyboard: true
      };

      if (sock) {
        connConfig.sock = sock;
      }

      if (profile.authType === 'password') {
        connConfig.password = profile.password || '';
      } else if (profile.authType === 'agent') {
        const agent = resolveAgentEndpoint(profile);
        if (agent) connConfig.agent = agent;
      } else {
        const privateKey = this.resolvePrivateKey(profile);
        if (privateKey) {
          connConfig.privateKey = privateKey;
          if (profile.passphrase) {
            connConfig.passphrase = profile.passphrase;
          }
        } else if (profile.password) {
          connConfig.password = profile.password;
        }
      }

      conn.on('keyboard-interactive', (_name, instructions, _lang, prompts, finish) => {
        this.beginKeyboardPrompt(profile.id, {
          instructions: String(instructions || ''),
          prompts: (prompts || []).map((item) => ({
            prompt: String(item.prompt || ''),
            echo: Boolean(item.echo)
          }))
        }, finish);
      });

      conn.on('ready', () => {
        if (pool && connId) {
          this.connections.set(connId, conn);
          this.touch(connId);
        }
        resolve(conn);
      });

      conn.on('error', (err) => {
        if (releaseTransport) releaseTransport();
        if (pool) {
          this.connections.delete(connId);
          this.sftpSessions.delete(connId);
        }
        reject(err);
      });

      conn.on('close', () => {
        if (releaseTransport) releaseTransport();
        if (pool && this.connections.get(connId) === conn) {
          this.connections.delete(connId);
          this.sftpSessions.delete(connId);
        }
      });

      conn.connect(connConfig);
    });
  }

  async testConnection(profile) {
    if (profile.id) {
      this.disconnect(profile.id);
    }
    const start = Date.now();
    const conn = await this.getConnection(profile);
    const latency = Date.now() - start;

    return new Promise((resolve) => {
      conn.exec('uname -s -r -m || ver', (err, stream) => {
        if (err) {
          return resolve({
            success: true,
            latency,
            latencyMs: latency,
            os: 'Unknown',
            remoteOs: 'Unknown'
          });
        }
        let output = '';
        stream.on('data', (d) => { output += d.toString(); });
        stream.on('close', () => {
          const osStr = output.trim() || 'Unknown';
          resolve({
            success: true,
            latency,
            latencyMs: latency,
            os: osStr,
            remoteOs: osStr
          });
        });
      });
    });
  }

  async getSftp(profile) {
    const connId = profile.id;
    if (this.sftpSessions.has(connId)) {
      return this.sftpSessions.get(connId);
    }
    const conn = await this.getConnection(profile);
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) return reject(err);
        this.sftpSessions.set(connId, sftp);
        resolve(sftp);
      });
    });
  }

  async exec(profile, command, optionsOrCwd = null, legacyOnData = null) {
    const idempotent = !(optionsOrCwd && typeof optionsOrCwd === 'object' && optionsOrCwd.idempotent === false);
    return runWithReconnect(
      () => this.execAttempt(profile, command, optionsOrCwd, legacyOnData),
      {
        idempotent,
        onRetry: () => this.disconnect(profile && profile.id)
      }
    );
  }

  async execAttempt(profile, command, optionsOrCwd = null, legacyOnData = null) {
    let cwd = null;
    let onData = legacyOnData;
    let pty = false;
    let timeoutMs = 0;
    let cleanAnsi = false;
    let maxBufferSize = 10 * 1024 * 1024;

    if (typeof optionsOrCwd === 'string') {
      cwd = optionsOrCwd;
    } else if (optionsOrCwd && typeof optionsOrCwd === 'object') {
      cwd = optionsOrCwd.cwd || null;
      onData = optionsOrCwd.onData || legacyOnData;
      pty = Boolean(optionsOrCwd.pty);
      timeoutMs = optionsOrCwd.timeout ? optionsOrCwd.timeout * 1000 : (optionsOrCwd.timeoutMs || 0);
      cleanAnsi = Boolean(optionsOrCwd.cleanAnsi);
      if (typeof optionsOrCwd.maxBufferSize === 'number') {
        maxBufferSize = optionsOrCwd.maxBufferSize;
      } else if (typeof optionsOrCwd.maxBuffer === 'number') {
        maxBufferSize = optionsOrCwd.maxBuffer;
      }
    }

    this.bumpInFlight(profile.id, 1);
    let conn;
    try {
    conn = await this.getConnection(profile);
    } catch (err) {
      this.bumpInFlight(profile.id, -1);
      throw err;
    }
    const safeCwd = cwd ? "'" + String(cwd).replace(/'/g, "'\\''") + "'" : '';
    const shellCmd = cwd ? `cd ${safeCwd} && ${command}` : command;

    const execOptions = {};
    if (pty) {
      execOptions.pty = {
        rows: typeof pty === 'object' ? (pty.rows || 24) : 24,
        cols: typeof pty === 'object' ? (pty.cols || 80) : 80,
        term: typeof pty === 'object' ? (pty.term || 'xterm-256color') : 'xterm-256color'
      };
    }

    return new Promise((resolve, reject) => {
      let timer = null;

      conn.exec(shellCmd, execOptions, (err, stream) => {
        if (err) {
          this.bumpInFlight(profile.id, -1);
          return reject(err);
        }
        let stdout = '';
        let stderr = '';
        let truncated = false;

        if (timeoutMs > 0) {
          timer = setTimeout(() => {
            try {
              stream.signal('SIGTERM');
              stream.close();
            } catch (err) { /* best-effort cleanup */ }
            const errTimeout = new Error(`Command timed out after ${timeoutMs / 1000}s: ${command}`);
            errTimeout.code = 'COMMAND_TIMEOUT';
            errTimeout.commandTimeout = true;
            errTimeout.stdout = cleanAnsi ? stripAnsi(stdout) : stdout;
            errTimeout.stderr = cleanAnsi ? stripAnsi(stderr) : stderr;
            reject(errTimeout);
          }, timeoutMs);
        }

        stream.on('data', (data) => {
          const str = data.toString();
          if (stdout.length < maxBufferSize) {
            const remaining = maxBufferSize - stdout.length;
            stdout += str.length > remaining ? str.slice(0, remaining) : str;
            if (str.length > remaining) {
              truncated = true;
              stdout += '\n[Output truncated: exceeded max buffer size]';
              try { stream.signal('SIGTERM'); stream.close(); } catch (_err) { /* ignore best-effort process termination */ }
            }
          }
          if (onData) onData({ type: 'stdout', data: str });
        });

        stream.stderr?.on('data', (data) => {
          const str = data.toString();
          if (stderr.length < maxBufferSize) {
            const remaining = maxBufferSize - stderr.length;
            stderr += str.length > remaining ? str.slice(0, remaining) : str;
            if (str.length > remaining) {
              truncated = true;
              stderr += '\n[Stderr truncated: exceeded max buffer size]';
              try { stream.signal('SIGTERM'); stream.close(); } catch (_err) { /* ignore best-effort process termination */ }
            }
          }
          if (onData) onData({ type: 'stderr', data: str });
        });

        stream.on('close', (code, signal) => {
          if (timer) clearTimeout(timer);
          this.bumpInFlight(profile.id, -1);
          resolve({
            code: code ?? 0,
            signal,
            stdout: cleanAnsi ? stripAnsi(stdout) : stdout,
            stderr: cleanAnsi ? stripAnsi(stderr) : stderr,
            truncated
          });
        });
      });
    });
  }

  /**
   * Direct Server-to-Server file transfer streaming between two SSH hosts.
   * Reads from srcProfile SFTP stream and pipes directly into destProfile SFTP stream.
   * No intermediate files touch the local DSH disk!
   */
  async transferFileBetweenHosts(srcProfile, srcPath, destProfile, destPath) {
    const srcSftp = await this.getSftp(srcProfile);
    const destSftp = await this.getSftp(destProfile);

    return new Promise((resolve, reject) => {
      const readStream = srcSftp.createReadStream(srcPath);
      const writeStream = destSftp.createWriteStream(destPath);
      let bytesTransferred = 0;

      readStream.on('data', (chunk) => {
        bytesTransferred += chunk.length;
      });

      writeStream.on('finish', () => {
        resolve({
          success: true,
          bytesTransferred,
          srcHost: srcProfile.host,
          destHost: destProfile.host,
          srcPath,
          destPath
        });
      });

      readStream.on('error', (err) => reject(new Error(`Read from ${srcProfile.host} failed: ${err.message}`)));
      writeStream.on('error', (err) => reject(new Error(`Write to ${destProfile.host} failed: ${err.message}`)));

      readStream.pipe(writeStream);
    });
  }

  async createTerminalSession(profile, options = {}) {
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
          this.terminalSessions.delete(sessionId);
        });

        this.terminalSessions.set(sessionId, session);
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

  getTerminalSession(sessionId) {
    return this.terminalSessions.get(sessionId);
  }

  closeTerminalSession(sessionId) {
    const session = this.terminalSessions.get(sessionId);
    if (session) {
      session.close();
      this.terminalSessions.delete(sessionId);
      return true;
    }
    return false;
  }

  async listPersistentSessions(profile) {
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

  async killPersistentSession(profile, sessionName) {
    if (!profile || !sessionName) return false;
    const sanitized = sessionName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const res = await this.exec(profile, `tmux kill-session -t ${sanitized} 2>/dev/null || true`);
    for (const [id, s] of this.terminalSessions.entries()) {
      if (s.profileId === profile.id && s.sessionName === sessionName) {
        s.close();
        this.terminalSessions.delete(id);
      }
    }
    return res.code === 0;
  }


  async searchCodebase(profile, options = {}) {
    if (!profile) throw new Error('Profile is required');
    const {
      query,
      isRegex = false,
      path: searchPath = profile.remoteWorkspace,
      maxResults = 50,
      filePattern = null,
    } = options;

    if (!query || typeof query !== 'string') {
      throw new Error('Search query is required');
    }

    const escapedQuery = query.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
    const escapedPath = (searchPath || '.').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    const rgPatternArg = filePattern ? `--glob "${filePattern.replace(/"/g, '\\"')}"` : '';
    const grepPatternArg = filePattern ? `--include="${filePattern.replace(/"/g, '\\"')}"` : '';

    const rgRegexFlag = isRegex ? '' : '-F';
    const grepRegexFlag = isRegex ? '-E' : '-F';

    const shellScript = `
if command -v rg >/dev/null 2>&1; then
  rg ${rgRegexFlag} --line-number --no-heading --color=never --hidden \
    --glob '!.git' --glob '!node_modules' --glob '!dist' --glob '!build' --glob '!vendor' --glob '!__pycache__' --glob '!.next' --glob '!coverage' \
    ${rgPatternArg} --max-count ${maxResults + 1} "${escapedQuery}" "${escapedPath}" 2>/dev/null || true
else
  grep -rnI ${grepRegexFlag} \
    --exclude-dir={.git,node_modules,dist,build,vendor,__pycache__,.next,coverage} \
    ${grepPatternArg} "${escapedQuery}" "${escapedPath}" 2>/dev/null | head -n ${maxResults + 1} || true
fi
`.trim();

    const execRes = await this.exec(profile, shellScript, {
      cwd: searchPath || profile.remoteWorkspace,
      timeout: 15,
      maxBufferSize: 128 * 1024,
    });

    const lines = (execRes.stdout || '').split(/\r?\n/).filter(line => line.trim().length > 0);
    const matches = [];
    const normBase = searchPath && searchPath.endsWith('/') ? searchPath : `${searchPath}/`;

    for (const line of lines) {
      if (matches.length >= maxResults) break;
      const firstColon = line.indexOf(':');
      if (firstColon === -1) continue;
      const secondColon = line.indexOf(':', firstColon + 1);
      if (secondColon === -1) continue;

      const rawFile = line.slice(0, firstColon);
      const lineNumStr = line.slice(firstColon + 1, secondColon);
      const text = line.slice(secondColon + 1);

      const lineNum = parseInt(lineNumStr, 10);
      if (isNaN(lineNum)) continue;

      let relFile = rawFile;
      if (normBase && rawFile.startsWith(normBase)) {
        relFile = rawFile.slice(normBase.length);
      } else if (searchPath && rawFile.startsWith(searchPath)) {
        relFile = rawFile.slice(searchPath.length).replace(/^\/+/, '');
      }

      matches.push({
        file: relFile,
        line: lineNum,
        text: text.trimEnd(),
      });
    }

    return {
      query,
      path: searchPath,
      matches,
      totalMatches: matches.length,
      truncated: lines.length > maxResults,
    };
  }

  invalidate(profileId) {

    this.disconnect(profileId);
  }

  disconnect(profileId) {
    const conn = this.connections.get(profileId);
    if (conn) {
      try { conn.end(); } catch (err) { /* best-effort cleanup */ }
      this.connections.delete(profileId);
      this.sftpSessions.delete(profileId);
    }
  }

  disconnectAll() {
    for (const [id, conn] of this.connections.entries()) {
      try { conn.end(); } catch (err) { /* best-effort cleanup */ }
    }
    this.connections.clear();
    this.sftpSessions.clear();
    for (const [id, term] of this.terminalSessions.entries()) {
      try { term.close(); } catch (err) { /* best-effort cleanup */ }
    }
    this.terminalSessions.clear();
  }
}
