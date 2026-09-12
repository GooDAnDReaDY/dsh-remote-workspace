import { Client } from 'ssh2';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Utility to strip ANSI escape sequences from terminal output for clean LLM ingestion
 */
export function stripAnsi(str) {
  if (!str) return '';
  // Match standard ANSI escape codes, OSC sequences, and CSI codes
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
  }

  setVaultService(vault) {
    this.vaultService = vault;
  }

  /**
   * Resolve private key content either from direct string or file path
   */
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
      } catch (_) {}
    }
    return undefined;
  }

  /**
   * Connect to remote machine with pooling, keep-alive, and auto-reconnect
   */
  async getConnection(rawProfile) {
    const profile = this.vaultService ? this.vaultService.hydrateProfile(rawProfile) : rawProfile;
    const connId = profile.id;

    const existing = this.connections.get(connId);
    if (existing && existing._sock && !existing._sock.destroyed) {
      return existing;
    }

    // Clean any broken reference
    this.connections.delete(connId);
    this.sftpSessions.delete(connId);

    return new Promise((resolve, reject) => {
      const conn = new Client();
      const connConfig = {
        host: profile.host,
        port: profile.port || 22,
        username: profile.username || 'root',
        keepaliveInterval: 15000,
        keepaliveCountMax: 3,
        readyTimeout: 20000
      };

      if (profile.authType === 'password') {
        connConfig.password = profile.password || '';
      } else if (profile.authType === 'agent') {
        connConfig.agent = process.env.SSH_AUTH_SOCK;
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

      conn.on('ready', () => {
        this.connections.set(connId, conn);
        resolve(conn);
      });

      conn.on('error', (err) => {
        this.connections.delete(connId);
        this.sftpSessions.delete(connId);
        reject(err);
      });

      conn.on('close', () => {
        this.connections.delete(connId);
        this.sftpSessions.delete(connId);
      });

      conn.connect(connConfig);
    });
  }

  /**
   * Test connection and measure ping / detect OS
   */
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

  /**
   * Obtain active SFTP wrapper with connection reuse
   */
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

  /**
   * Execute command on remote host with PTY, streaming, timeout, and ANSI sanitization
   * @param {any} profile
   * @param {string} command
   * @param {string|object} [optionsOrCwd] - cwd string or options object
   * @param {function} [legacyOnData]
   */
  async exec(profile, command, optionsOrCwd = null, legacyOnData = null) {
    let cwd = null;
    let onData = legacyOnData;
    let pty = false;
    let timeoutMs = 0;
    let cleanAnsi = false;

    if (typeof optionsOrCwd === 'string') {
      cwd = optionsOrCwd;
    } else if (optionsOrCwd && typeof optionsOrCwd === 'object') {
      cwd = optionsOrCwd.cwd || null;
      onData = optionsOrCwd.onData || legacyOnData;
      pty = Boolean(optionsOrCwd.pty);
      timeoutMs = optionsOrCwd.timeout ? optionsOrCwd.timeout * 1000 : 0;
      cleanAnsi = Boolean(optionsOrCwd.cleanAnsi);
    }

    const conn = await this.getConnection(profile);
    const shellCmd = cwd ? `cd ${JSON.stringify(cwd)} && ${command}` : command;

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
        if (err) return reject(err);
        let stdout = '';
        let stderr = '';

        if (timeoutMs > 0) {
          timer = setTimeout(() => {
            try {
              stream.signal('SIGTERM');
              stream.close();
            } catch (_) {}
            const errTimeout = new Error(`Command timed out after ${timeoutMs / 1000}s: ${command}`);
            errTimeout.code = 'ETIMEDOUT';
            errTimeout.stdout = cleanAnsi ? stripAnsi(stdout) : stdout;
            errTimeout.stderr = cleanAnsi ? stripAnsi(stderr) : stderr;
            reject(errTimeout);
          }, timeoutMs);
        }

        stream.on('data', (data) => {
          const str = data.toString();
          stdout += str;
          if (onData) onData({ type: 'stdout', data: str });
        });

        stream.stderr?.on('data', (data) => {
          const str = data.toString();
          stderr += str;
          if (onData) onData({ type: 'stderr', data: str });
        });

        stream.on('close', (code, signal) => {
          if (timer) clearTimeout(timer);
          resolve({
            code: code ?? 0,
            signal,
            stdout: cleanAnsi ? stripAnsi(stdout) : stdout,
            stderr: cleanAnsi ? stripAnsi(stderr) : stderr
          });
        });
      });
    });
  }

  /**
   * Create an interactive PTY terminal session for Web UI
   */
  async createTerminalSession(profile, options = {}) {
    const conn = await this.getConnection(profile);
    const cols = options.cols || 80;
    const rows = options.rows || 24;
    const term = options.term || 'xterm-256color';
    const sessionId = `term_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return new Promise((resolve, reject) => {
      conn.shell({ term, cols, rows }, (err, stream) => {
        if (err) return reject(err);

        const session = {
          id: sessionId,
          profileId: profile.id,
          stream,
          createdAt: Date.now(),
          buffer: [],
          subscribers: new Set(),
          write(data) {
            try { stream.write(data); } catch (_) {}
          },
          resize(c, r) {
            try { stream.setWindow(r, c, 0, 0); } catch (_) {}
          },
          close() {
            try { stream.end(); } catch (_) {}
          }
        };

        stream.on('data', (d) => {
          const chunk = d.toString('utf8');
          session.buffer.push(chunk);
          if (session.buffer.length > 500) session.buffer.shift();
          for (const sub of session.subscribers) {
            try { sub(chunk); } catch (_) {}
          }
        });

        stream.on('close', () => {
          this.terminalSessions.delete(sessionId);
        });

        this.terminalSessions.set(sessionId, session);
        resolve(session);
      });
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

  invalidate(profileId) {
    this.disconnect(profileId);
  }

  disconnect(profileId) {
    const conn = this.connections.get(profileId);
    if (conn) {
      try { conn.end(); } catch (_) {}
      this.connections.delete(profileId);
      this.sftpSessions.delete(profileId);
    }
  }

  disconnectAll() {
    for (const [id, conn] of this.connections.entries()) {
      try { conn.end(); } catch (_) {}
    }
    this.connections.clear();
    this.sftpSessions.clear();
    for (const [id, term] of this.terminalSessions.entries()) {
      try { term.close(); } catch (_) {}
    }
    this.terminalSessions.clear();
  }
}
