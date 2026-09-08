import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class MirrorSyncService {
  /**
   * @param {import('./remote-fs-service.js').RemoteFsService} remoteFs
   * @param {import('./ssh-service.js').SshService} sshService
   */
  constructor(remoteFs, sshService) {
    this.remoteFs = remoteFs;
    this.sshService = sshService;
    this.defaultIgnore = [
      '.git',
      'node_modules',
      '.worktrees',
      'dist',
      'build',
      '.next',
      '.cache',
      '*.pyc',
      '__pycache__'
    ];
  }

  computeHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  isIgnored(relPath) {
    const parts = relPath.split(/[\\/]/);
    for (const pattern of this.defaultIgnore) {
      if (pattern.startsWith('*.')) {
        const ext = pattern.slice(1);
        if (relPath.endsWith(ext)) return true;
      } else {
        if (parts.includes(pattern)) return true;
      }
    }
    return false;
  }

  /**
   * 3-way conflict aware pull: Remote -> Local Mirror
   */
  async pull(profile, remoteDir, localDir, dryRun = false) {
    fs.mkdirSync(localDir, { recursive: true });
    const snapshotFile = path.join(localDir, '.dsh-sync-snapshot.json');
    let lastSnapshot = {};
    if (fs.existsSync(snapshotFile)) {
      try {
        lastSnapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
      } catch (_) {}
    }

    const conflicts = [];
    const updated = [];
    const newSnapshot = { ...lastSnapshot };

    // Find remote files using find over ssh for speed
    const findCmd = `find . -maxdepth 5 -type f ! -path '*/.*' ! -path '*/node_modules/*' -printf '%P\\t%s\\t%T@\\n'`;
    const execRes = await this.sshService.exec(profile, findCmd, remoteDir);
    if (execRes.code !== 0) {
      throw new Error(`Failed to scan remote dir: ${execRes.stderr}`);
    }

    const lines = execRes.stdout.split('\n').filter(Boolean);
    for (const line of lines) {
      const [relPath] = line.split('\t');
      if (!relPath || this.isIgnored(relPath)) continue;

      const remoteFullPath = path.posix.join(remoteDir, relPath);
      const localFullPath = path.join(localDir, relPath);

      const remoteContent = await this.remoteFs.readFile(profile, remoteFullPath, 'utf8');
      const remoteHash = this.computeHash(remoteContent);
      const baseHash = lastSnapshot[relPath];

      let localContent = null;
      let localHash = null;
      if (fs.existsSync(localFullPath)) {
        localContent = fs.readFileSync(localFullPath, 'utf8');
        localHash = this.computeHash(localContent);
      }

      // Check conflict: both changed compared to last baseline
      if (baseHash && localHash && remoteHash !== baseHash && localHash !== baseHash && remoteHash !== localHash) {
        conflicts.push({ path: relPath, reason: 'Modified on both remote and local' });
        continue;
      }

      if (localHash !== remoteHash) {
        updated.push(relPath);
        if (!dryRun) {
          fs.mkdirSync(path.dirname(localFullPath), { recursive: true });
          fs.writeFileSync(localFullPath, remoteContent, 'utf8');
          newSnapshot[relPath] = remoteHash;
        }
      } else {
        newSnapshot[relPath] = remoteHash;
      }
    }

    if (!dryRun) {
      fs.writeFileSync(snapshotFile, JSON.stringify(newSnapshot, null, 2), 'utf8');
    }

    return {
      success: conflicts.length === 0,
      pulled: updated,
      conflicts,
      dryRun
    };
  }

  /**
   * 3-way conflict aware push: Local Mirror -> Remote
   */
  async push(profile, localDir, remoteDir, force = false, dryRun = false) {
    const snapshotFile = path.join(localDir, '.dsh-sync-snapshot.json');
    let snapshot = {};
    if (fs.existsSync(snapshotFile)) {
      try {
        snapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
      } catch (_) {}
    }

    const pushed = [];
    const conflicts = [];

    const walkLocal = (dir, rootDir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      let files = [];
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(rootDir, full);
        if (this.isIgnored(rel)) continue;
        if (entry.isDirectory()) {
          files = files.concat(walkLocal(full, rootDir));
        } else if (entry.isFile()) {
          files.push(rel);
        }
      }
      return files;
    };

    const localFiles = walkLocal(localDir, localDir);
    for (const rel of localFiles) {
      const localFull = path.join(localDir, rel);
      const remoteFull = path.posix.join(remoteDir, rel.replace(/\\/g, '/'));
      const content = fs.readFileSync(localFull, 'utf8');
      const localHash = this.computeHash(content);
      const baseHash = snapshot[rel];

      if (baseHash && baseHash === localHash && !force) {
        continue; // Unchanged locally
      }

      if (!dryRun) {
        // Ensure remote parent dir exists
        const parent = path.posix.dirname(remoteFull);
        await this.remoteFs.mkdir(profile, parent);
        await this.remoteFs.writeFile(profile, remoteFull, content, 'utf8');
        snapshot[rel] = localHash;
      }
      pushed.push(rel);
    }

    if (!dryRun) {
      fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2), 'utf8');
    }

    return {
      success: true,
      pushed,
      conflicts,
      dryRun
    };
  }
}
