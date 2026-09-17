import { Client } from 'ssh2';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

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
      return existing;
    }

    this.connections.delete(connId);
    this.sftpSessions.delete(connId);

    // If jumpHost is configured, obtain socket through the jump host first
    let sock = undefined;
    if (profile.jumpHostId && this.getJumpProfile) {
      const jumpProfile = this.getJumpProfile(profile.jumpHostId);
      if (jumpProfile) {
        const jumpConn = await this.getConnection(jumpProfile);
        sock = await new Promise((resolve, reject) => {
          jumpConn.forwardOut('127.0.0.1', 0, profile.host, profile.port || 22, (err, stream) => {
            if (err) return reject(new Error(`ProxyJump via ${jumpProfile.host} failed: ${err.message}`));
            resolve(stream);
          });
        });
      }
    }

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

      if (sock) {
        connConfig.sock = sock;
      }

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
            } catch (err) { /* best-effort cleanup */ }
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
            try { stream.write(data); } catch (err) { session.status = 'disconnected'; const lost = '\r\n\x1b[31m[Connection lost]\x1b[0m\r\n'; session.buffer.push(lost); for (const sub of session.subscribers) { try { sub(lost); } catch (e) { /* best-effort notify */ } } }
          },
          resize(c, r) {
            try { stream.setWindow(r, c, 0, 0); } catch (err) { /* best-effort cleanup */ }
          },
          close() {
            try { stream.end(); } catch (err) { /* best-effort cleanup */ }
          }
        };

        stream.on('data', (d) => {
          const chunk = d.toString('utf8');
          session.buffer.push(chunk);
          if (session.buffer.length > 500) session.buffer.shift();
          for (const sub of session.subscribers) {
            try { sub(chunk); } catch (err) { /* best-effort cleanup */ }
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
