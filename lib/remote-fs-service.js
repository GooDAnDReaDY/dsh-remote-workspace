import path from 'node:path';

export class RemoteFsService {
  /**
   * @param {import('./ssh-service.js').SshService} sshService
   */
  constructor(sshService) {
    this.sshService = sshService;
    /** @type {Map<string, { data: any, expiresAt: number }>} */
    this.cache = new Map();
    this.cacheTtlMs = 15000; // 15 seconds
  }

  cacheKey(profileId, action, remotePath) {
    return `${profileId}:${action}:${remotePath}`;
  }

  invalidateCache(profileId, subPath = null) {
    if (!profileId) {
      this.cache.clear();
      return;
    }
    const prefix = subPath ? `${profileId}:` : `${profileId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        if (!subPath || key.includes(subPath)) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Read directory entries with in-memory TTL cache
   */
  async listDir(profile, remotePath, bypassCache = false) {
    const key = this.cacheKey(profile.id, 'list', remotePath);
    if (!bypassCache) {
      const cached = this.cache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }
    }

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
        this.cache.set(key, { data: entries, expiresAt: Date.now() + this.cacheTtlMs });
        resolve(entries);
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
        return cached.data;
      }
    }

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
        this.cache.set(key, { data: res, expiresAt: Date.now() + this.cacheTtlMs });
        resolve(res);
      });
    });
  }

  /**
   * Read file content with buffer/string conversion
   */
  async readFile(profile, remotePath, encoding = 'utf8') {
    const sftp = await this.sshService.getSftp(profile);
    return new Promise((resolve, reject) => {
      const chunks = [];
      const stream = sftp.createReadStream(remotePath);
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve(encoding ? buf.toString(encoding) : buf);
      });
      stream.on('error', (err) => reject(err));
    });
  }

  /**
   * Get raw SFTP readable stream
   */
  async createReadStream(profile, remotePath) {
    const sftp = await this.sshService.getSftp(profile);
    return sftp.createReadStream(remotePath);
  }

  /**
   * Atomic file write using temp file and rename
   */
  async writeFile(profile, remotePath, content, encoding = 'utf8') {
    const sftp = await this.sshService.getSftp(profile);
    const tempPath = `${remotePath}.dsh-tmp.${Date.now()}`;
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, encoding);

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
  async mkdir(profile, remotePath) {
    const cmd = `mkdir -p ${JSON.stringify(remotePath)}`;
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
  async remove(profile, remotePath, recursive = false) {
    const cmd = recursive ? `rm -rf ${JSON.stringify(remotePath)}` : `rm -f ${JSON.stringify(remotePath)}`;
    const res = await this.sshService.exec(profile, cmd);
    if (res.code !== 0) {
      throw new Error(`Failed to remove remote path ${remotePath}: ${res.stderr}`);
    }
    this.invalidateCache(profile.id);
    return { success: true };
  }
}
