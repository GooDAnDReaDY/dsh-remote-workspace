import { Client } from 'ssh2';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { expandProxyCommand, openProxyCommand } from './proxy-command.js';
import { openJumpChain, resolveJumpHops } from './jump-chain.js';
import { resolveAgentEndpoint } from './agent-endpoint.js';
import { runWithReconnect } from './exec-retry.js';
import { HostKeyStore } from './host-key-store.js';
import { HostKeyGate } from './host-key-gate.js';
import { KeyboardPromptManager } from './keyboard-prompts.js';
import { TerminalSessionManager } from './terminal-session-manager.js';
import { searchCodebase as runWorkspaceSearch } from './ssh-search.js';

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
    // #173: terminal lifecycle and keyboard prompts live in their own modules;
    // terminalSessions stays exposed for compatibility (the reaper test and
    // lifecycle paths read/write the same map).
    this.terminalManager = new TerminalSessionManager({
      connectDedicated: (profile, sock) => this.connectDedicated(profile, sock),
      exec: (profile, cmd, opts) => this.exec(profile, cmd, opts)
    });
    this.terminalSessions = this.terminalManager.sessions;
    this.keyboardPrompts = new KeyboardPromptManager();
    /** @type {Map<string, { lastUsed: number, inFlight: number, pinned: boolean }>} */
    this.connMeta = new Map();
    /** @type {Map<string, { host: string, port: number, fingerprint: string, algorithm: string, status: string }>} */
    this.hostKeyInfo = new Map();
    this.hostKeyStore = new HostKeyStore();
    this.hostKeyGate = new HostKeyGate({ getStore: () => this.hostKeyStore, info: this.hostKeyInfo });
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
    return this.terminalManager.sweepAbandoned(now, idleTimeoutMs);
  }

  connectDedicated(profile, sock) {
    const hydrated = this.vaultService ? this.vaultService.hydrateProfile(profile) : profile;
    return this._dial(hydrated, sock, null, false);
  }

  beginKeyboardPrompt(profileId, view, finish, timeoutMs = 60000) {
    return this.keyboardPrompts.begin(profileId, view, finish, timeoutMs);
  }

  listKeyboardPrompts() {
    return this.keyboardPrompts.list();
  }

  submitKeyboardPrompt(profileId, answers) {
    return this.keyboardPrompts.submit(profileId, answers);
  }

  clearKeyboardPrompt(profileId) {
    return this.keyboardPrompts.clear(profileId);
  }

  /**
   * Host key verification gate (#158, #173): the policy lives in
   * lib/host-key-gate.js; the store and diagnostics map stay here.
   */
  _verifyHostKey(profile, hostKey) {
    return this.hostKeyGate.verify(profile, hostKey);
  }

  getHostKeyInfo(profileId) {
    return this.hostKeyGate.get(profileId);
  }

  _hostVerifier(profile, connId) {
    return this.hostKeyGate.verifier(profile, connId);
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

      // #158: verify the server host key before the handshake completes.
      if (profile.host) {
        connConfig.hostVerifier = this._hostVerifier(profile, connId);
      }

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
            remoteOs: 'Unknown',
            hostKey: this.getHostKeyInfo(profile.id)
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
            remoteOs: osStr,
            hostKey: this.getHostKeyInfo(profile.id)
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
        if (optionsOrCwd && typeof optionsOrCwd === 'object' && optionsOrCwd.input !== undefined && optionsOrCwd.input !== null) {
          try {
            stream.write(optionsOrCwd.input);
            stream.end();
          } catch (_wErr) { /* ignore write stream error */ }
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

    // #161: only regular files are supported; directories and special files
    // are rejected explicitly instead of failing mid-stream.
    const srcStat = await new Promise((resolve, reject) => {
      srcSftp.stat(srcPath, (err, stat) => {
        if (err) reject(new Error(`Cannot stat ${srcProfile.host}:${srcPath}: ${err.message}`));
        else resolve(stat);
      });
    });
    if (srcStat && typeof srcStat.isDirectory === 'function' && srcStat.isDirectory()) {
      throw new Error(`Source path ${srcProfile.host}:${srcPath} is a directory; remote_transfer supports regular files only`);
    }

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

  createTerminalSession(...args) {
    return this.terminalManager.create(...args);
  }

  getTerminalSession(sessionId) {
    return this.terminalManager.get(sessionId);
  }

  closeTerminalSession(sessionId) {
    return this.terminalManager.close(sessionId);
  }

  async listPersistentSessions(profile) {
    return this.terminalManager.listPersistent(profile);
  }

  async killPersistentSession(profile, sessionName) {
    return this.terminalManager.killPersistent(profile, sessionName);
  }

  async searchCodebase(profile, options = {}) {
    return runWorkspaceSearch(this, profile, options);
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
    this.terminalManager.closeAll();
  }
}
