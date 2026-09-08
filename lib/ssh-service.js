import { Client } from 'ssh2';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export class SshService {
  constructor(ctx) {
    this.ctx = ctx;
    /** @type {Map<string, Client>} */
    this.connections = new Map();
    /** @type {Map<string, any>} */
    this.sftpSessions = new Map();
  }

  /**
   * Resolve private key content either from direct string or file path
   */
  resolvePrivateKey(profile) {
    if (profile.privateKey && profile.privateKey.trim()) {
      return profile.privateKey;
    }
    if (profile.privateKeyPath) {
      let resolvedPath = profile.privateKeyPath;
      if (resolvedPath.startsWith('~')) {
        resolvedPath = path.join(os.homedir(), resolvedPath.slice(1));
      }
      if (fs.existsSync(resolvedPath)) {
        return fs.readFileSync(resolvedPath, 'utf8');
      }
    }
    return undefined;
  }

  /**
   * Connect to remote machine with pooling and keep-alive
   */
  async getConnection(profile) {
    const connId = profile.id;
    const existing = this.connections.get(connId);
    if (existing && existing._sock && !existing._sock.destroyed) {
      return existing;
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

      if (profile.authType === 'password') {
        connConfig.password = profile.password;
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
    const start = Date.now();
    const conn = await this.getConnection(profile);
    const latency = Date.now() - start;

    return new Promise((resolve) => {
      conn.exec('uname -s -r -m || ver', (err, stream) => {
        if (err) {
          return resolve({ success: true, latency, os: 'Unknown' });
        }
        let output = '';
        stream.on('data', (d) => { output += d.toString(); });
        stream.on('close', () => {
          resolve({ success: true, latency, os: output.trim() });
        });
      });
    });
  }

  /**
   * Obtain active SFTP wrapper
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
   * Execute command on remote host
   */
  async exec(profile, command, cwd, onData) {
    const conn = await this.getConnection(profile);
    const shellCmd = cwd ? `cd ${JSON.stringify(cwd)} && ${command}` : command;

    return new Promise((resolve, reject) => {
      conn.exec(shellCmd, (err, stream) => {
        if (err) return reject(err);
        let stdout = '';
        let stderr = '';
        stream.on('data', (data) => {
          const str = data.toString();
          stdout += str;
          if (onData) onData({ type: 'stdout', data: str });
        });
        stream.stderr.on('data', (data) => {
          const str = data.toString();
          stderr += str;
          if (onData) onData({ type: 'stderr', data: str });
        });
        stream.on('close', (code, signal) => {
          resolve({ code: code ?? 0, signal, stdout, stderr });
        });
      });
    });
  }

  disconnect(profileId) {
    const conn = this.connections.get(profileId);
    if (conn) {
      conn.end();
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
  }
}
