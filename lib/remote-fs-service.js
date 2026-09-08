import path from 'node:path';

export class RemoteFsService {
  /**
   * @param {import('./ssh-service.js').SshService} sshService
   */
  constructor(sshService) {
    this.sshService = sshService;
  }

  /**
   * Read directory entries
   */
  async listDir(profile, remotePath) {
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
        resolve(entries);
      });
    });
  }

  /**
   * Stat remote path
   */
  async stat(profile, remotePath) {
    const sftp = await this.sshService.getSftp(profile);
    return new Promise((resolve, reject) => {
      sftp.stat(remotePath, (err, stats) => {
        if (err) return reject(err);
        resolve({
          isDirectory: (stats.mode & 0o40000) !== 0,
          isFile: (stats.mode & 0o100000) !== 0,
          size: stats.size,
          mtime: stats.mtime
        });
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
          // If rename fails, try unlink temp
          sftp.unlink(tempPath, () => {});
          return reject(err);
        }
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
    return { success: true };
  }
}
