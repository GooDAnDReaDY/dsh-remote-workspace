import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

export class TarSyncService {
  /**
   * @param {import('./ssh-service.js').SshService} sshService
   */
  constructor(sshService) {
    this.sshService = sshService;
  }

  /**
   * Stream tar archive from Remote to Local directory
   * Remote runs: tar -czf - -C <remoteDir> .
   * Local receives stream and runs: tar -xzf - -C <localDir>
   */
  async pullTar(profile, remoteDir, localDir) {
    if (!profile) throw new Error('No profile provided');
    fs.mkdirSync(localDir, { recursive: true });

    const client = await this.sshService.getConnection(profile);
    return new Promise((resolve, reject) => {
      const remoteCmd = `tar --exclude='.git' --exclude='node_modules' -czf - -C "${remoteDir}" .`;
      client.exec(remoteCmd, (err, stream) => {
        if (err) return reject(err);

        const localTar = spawn('tar', ['-xzf', '-', '-C', localDir]);
        let stderr = '';
        localTar.stderr.on('data', (d) => { stderr += d.toString(); });

        stream.pipe(localTar.stdin);

        localTar.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Local tar extraction failed (code ${code}): ${stderr}`));
          } else {
            resolve({ ok: true, direction: 'pull', remoteDir, localDir });
          }
        });

        stream.on('error', reject);
        localTar.stdin.on('error', reject);
      });
    });
  }

  /**
   * Stream tar archive from Local to Remote directory
   * Local runs: tar -czf - -C <localDir> .
   * Remote receives stream and runs: tar -xzf - -C <remoteDir>
   */
  async pushTar(profile, localDir, remoteDir) {
    if (!profile) throw new Error('No profile provided');
    if (!fs.existsSync(localDir)) throw new Error(`Local dir does not exist: ${localDir}`);

    const client = await this.sshService.getConnection(profile);
    // Ensure remoteDir exists
    await this.sshService.exec(profile, `mkdir -p "${remoteDir}"`);

    return new Promise((resolve, reject) => {
      const remoteCmd = `tar -xzf - -C "${remoteDir}"`;
      client.exec(remoteCmd, (err, stream) => {
        if (err) return reject(err);

        const localTar = spawn('tar', ['--exclude=.git', '--exclude=node_modules', '-czf', '-', '-C', localDir, '.']);
        let remoteStderr = '';
        stream.stderr.on('data', (d) => { remoteStderr += d.toString(); });

        localTar.stdout.pipe(stream);

        stream.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Remote tar extraction failed (code ${code}): ${remoteStderr}`));
          } else {
            resolve({ ok: true, direction: 'push', localDir, remoteDir });
          }
        });

        stream.on('error', reject);
        localTar.on('error', reject);
      });
    });
  }
}
