function shellQuote(arg) {
  if (typeof arg !== 'string') arg = String(arg || '');
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}

import path from 'node:path';

export class RemoteFsService {
  /**
   * @param {import('./ssh-service.js').SshService} sshService
   */
  constructor(sshService) {
    this.sshService = sshService;
    /** @type {Map<string, { data: any, expiresAt: number }>} */
    this.cache = new Map();
    this.cacheTtlMs = 60000; // 60 seconds LRU cache
    this.maxCacheSize = 500;
    this.hits = 0;
    this.misses = 0;
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      ttlMs: this.cacheTtlMs,
      hits: this.hits,
      misses: this.misses
    };
  }

  clearCache(profileId = null) {
    if (!profileId) {
      this.cache.clear();
      return;
    }
    const prefix = `${profileId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  _setCache(key, data) {
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, { data, expiresAt: Date.now() + this.cacheTtlMs });
  }

  cacheKey(profileId, action, remotePath) {
    return `${profileId}:${action}:${remotePath}`;
  }

  invalidateCache(profileId, subPath = null) {
    if (!profileId) {
      this.cache.clear();
      return;
    }
    const prefix = `${profileId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        if (!subPath) {
          this.cache.delete(key);
        } else {
          const secondColon = key.indexOf(':', prefix.length);
          if (secondColon !== -1) {
            const cachedPath = key.slice(secondColon + 1);
            const normSub = path.posix.normalize(subPath);
            const normCached = path.posix.normalize(cachedPath);
            const subPrefix = normSub.endsWith('/') ? normSub : normSub + '/';
            const cachedPrefix = normCached.endsWith('/') ? normCached : normCached + '/';
            if (normCached === normSub || normCached.startsWith(subPrefix) || normSub.startsWith(cachedPrefix)) {
              this.cache.delete(key);
            }
          }
        }
      }
    }
  }

  /**
   * Read directory entries with in-memory TTL cache
   */
  async list(profile, remotePath, bypassCache = false) {
    return this.listDir(profile, remotePath, bypassCache);
  }

  async listDir(profile, remotePath, bypassCache = false) {
    const key = this.cacheKey(profile.id, 'list', remotePath);
    if (!bypassCache) {
      const cached = this.cache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        this.hits++;
        this.cache.delete(key);
        this.cache.set(key, cached);
        return cached.data;
      }
    }
    this.misses++;

    const sftp = await this.sshService.getSftp(profile);
    return new Promise((resolve, reject) => {
      sftp.readdir(remotePath, (err, list) => {
        if (err) return reject(err);
        const entries = list.map((item) => ({
          filename: item.filename,
          isDirectory: (item.attrs.mode & 0o40000) !== 0,
          isFile: (item.attrs.mode & 0o100000) !== 0,
          size: item.attrs.size,
          mtime: item.attrs.mtime,
          permissions: (item.attrs.mode & 0o777).toString(8)
        }));
        this._setCache(key, entries);
        resolve(entries);
      });
    });
  }

  /**
   * Resolve canonical realpath on remote host via SFTP
   */
  async realpath(profile, remotePath) {
    const sftp = await this.sshService.getSftp(profile);
    if (!sftp || typeof sftp.realpath !== 'function') {
      return path.posix.normalize(remotePath);
    }
    return new Promise((resolve, reject) => {
      sftp.realpath(remotePath, (err, absPath) => {
        if (err) return reject(err);
        resolve(absPath);
      });
    });
  }

  /**
   * Stat remote path with cache
   */
  async stat(profile, remotePath, bypassCache = false) {
    const key = this.cacheKey(profile.id, 'stat', remotePath);
    if (!bypassCache) {
      const cached = this.cache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        this.hits++;
        this.cache.delete(key);
        this.cache.set(key, cached);
        return cached.data;
      }
    }
    this.misses++;

    const sftp = await this.sshService.getSftp(profile);
    return new Promise((resolve, reject) => {
      sftp.stat(remotePath, (err, stats) => {
        if (err) return reject(err);
        const res = {
          isDirectory: (stats.mode & 0o40000) !== 0,
          isFile: (stats.mode & 0o100000) !== 0,
          size: stats.size,
          mtime: stats.mtime
        };
        this._setCache(key, res);
        resolve(res);
      });
    });
  }

  /**
   * Read file content with buffer/string conversion and optional sudo elevation
   */
  async readFile(profile, remotePath, encoding = 'utf8', maxBytes = 20 * 1024 * 1024, options = {}) {
    const useSudo = Boolean(options && (options.sudo || options.useSudo));
    if (useSudo) {
      return this._readFileSudo(profile, remotePath, encoding, maxBytes);
    }
    try {
      return await this._readFileSftp(profile, remotePath, encoding, maxBytes);
    } catch (err) {
      const isPerm = err.code === 'EACCES' || err.code === 3 || /permission denied/i.test(err.message);
      if (isPerm && options && options.fallbackSudo) {
        return this._readFileSudo(profile, remotePath, encoding, maxBytes);
      }
      throw err;
    }
  }

  async _readFileSudo(profile, remotePath, encoding = 'utf8', maxBytes = 20 * 1024 * 1024) {
    const cmd = `sudo -n cat ${shellQuote(remotePath)}`;
    const res = await this.sshService.exec(profile, cmd, {
      maxBufferSize: maxBytes,
      timeout: 30
    });
    if (res.code !== 0) {
      const err = new Error(`Failed to read ${remotePath} with sudo: ${res.stderr || res.stdout || 'exit code ' + res.code}`);
      err.code = res.code === 1 ? 'EACCES' : 'ERR_SUDO_FAILED';
      throw err;
    }
    return encoding ? res.stdout : Buffer.from(res.stdout, 'utf8');
  }

  async _readFileSftp(profile, remotePath, encoding = 'utf8', maxBytes = 20 * 1024 * 1024) {
    const sftp = await this.sshService.getSftp(profile);
    return new Promise((resolve, reject) => {
      const chunks = [];
      let totalBytes = 0;
      let destroyed = false;
      const stream = sftp.createReadStream(remotePath);
      stream.on('data', (chunk) => {
        if (destroyed) return;
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) {
          destroyed = true;
          try { stream.destroy(); } catch (_err) { /* ignore best-effort stream cleanup */ }
          const err = new Error(`ERR_FILE_TOO_LARGE: File size exceeds maximum allowed buffer of ${maxBytes / (1024 * 1024)}MB: ${remotePath}`);
          err.code = 'ERR_FILE_TOO_LARGE';
          return reject(err);
        }
        chunks.push(chunk);
      });
      stream.on('end', () => {
        if (destroyed) return;
        const buf = Buffer.concat(chunks);
        resolve(encoding ? buf.toString(encoding) : buf);
      });
      stream.on('error', (err) => {
        if (destroyed) return;
        reject(err);
      });
    });
  }

  /**
   * Get raw SFTP readable stream
   */
  async createReadStream(profile, remotePath) {
    const sftp = await this.sshService.getSftp(profile);
    return sftp.createReadStream(remotePath);
  }

  async beginUpload(profile, remotePath) {
    const sftp = await this.sshService.getSftp(profile);
    const tempPath = `${remotePath}.dsh-tmp.${Date.now()}`;
    const stream = sftp.createWriteStream(tempPath);
    return {
      stream,
      commit() {
        return new Promise((resolve, reject) => {
          sftp.rename(tempPath, remotePath, (err) => {
            if (err) {
              sftp.unlink(tempPath, () => {});
              return reject(err);
            }
            resolve();
          });
        });
      },
      abort() {
        return new Promise((resolve) => {
          sftp.unlink(tempPath, () => resolve());
        });
      }
    };
  }

  /**
   * Atomic file write using temp file or sudo elevation
   */
  async writeFile(profile, remotePath, content, encoding = 'utf8', options = {}) {
    const useSudo = Boolean(options && (options.sudo || options.useSudo));
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, encoding);
    if (useSudo) {
      return this._writeFileSudo(profile, remotePath, data);
    }
    try {
      return await this._writeFileSftp(profile, remotePath, data);
    } catch (err) {
      const isPerm = err.code === 'EACCES' || err.code === 3 || /permission denied/i.test(err.message);
      if (isPerm && options && options.fallbackSudo) {
        return this._writeFileSudo(profile, remotePath, data);
      }
      throw err;
    }
  }

  async _writeFileSudo(profile, remotePath, data) {
    const cmd = `sudo -n tee ${shellQuote(remotePath)} >/dev/null`;
    const res = await this.sshService.exec(profile, cmd, {
      input: data,
      timeout: 30
    });
    if (res.code !== 0) {
      const err = new Error(`Failed to write ${remotePath} with sudo: ${res.stderr || res.stdout || 'exit code ' + res.code}`);
      err.code = res.code === 1 ? 'EACCES' : 'ERR_SUDO_FAILED';
      throw err;
    }
    this.invalidateCache(profile.id, path.posix.dirname(remotePath));
    return { success: true, bytes: data.length, sudo: true };
  }

  async _writeFileSftp(profile, remotePath, data) {
    const sftp = await this.sshService.getSftp(profile);
    const tempPath = `${remotePath}.dsh-tmp.${Date.now()}`;

    await new Promise((resolve, reject) => {
      const stream = sftp.createWriteStream(tempPath);
      stream.on('finish', () => resolve());
      stream.on('error', (err) => reject(err));
      stream.end(data);
    });

    return new Promise((resolve, reject) => {
      sftp.rename(tempPath, remotePath, (err) => {
        if (err) {
          sftp.unlink(tempPath, () => {});
          return reject(err);
        }
        this.invalidateCache(profile.id, path.posix.dirname(remotePath));
        resolve({ success: true, bytes: data.length });
      });
    });
  }

  /**
   * Create remote directory recursively
   */
  async mkdir(profile, remotePath, options = {}) {
    const prefix = options && options.sudo ? 'sudo -n ' : '';
    const cmd = `${prefix}mkdir -p ${shellQuote(remotePath)}`;
    const res = await this.sshService.exec(profile, cmd);
    if (res.code !== 0) {
      throw new Error(`Failed to create remote dir ${remotePath}: ${res.stderr}`);
    }
    this.invalidateCache(profile.id);
    return { success: true };
  }

  /**
   * Remove remote file or directory
   */
  async remove(profile, remotePath, recursive = false, options = {}) {
    const prefix = options && options.sudo ? 'sudo -n ' : '';
    const cmd = recursive ? `${prefix}rm -rf ${shellQuote(remotePath)}` : `${prefix}rm -f ${shellQuote(remotePath)}`;
    const res = await this.sshService.exec(profile, cmd);
    if (res.code !== 0) {
      throw new Error(`Failed to remove remote path ${remotePath}: ${res.stderr}`);
    }
    this.invalidateCache(profile.id);
    return { success: true };
  }
}
