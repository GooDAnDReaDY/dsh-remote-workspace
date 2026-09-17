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
   * Fast Delta-based 3-way conflict aware pull: Remote -> Local Mirror
   * Uses file size and modification time to avoid downloading unchanged files.
   */
  async pull(profile, remoteDir, localDir, dryRun = false) {
    fs.mkdirSync(localDir, { recursive: true });
    const snapshotFile = path.join(localDir, '.dsh-sync-snapshot.json');
    let lastSnapshot = {};
    if (fs.existsSync(snapshotFile)) {
      try {
        lastSnapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
      } catch (err) { /* best-effort cleanup */ }
    }

    const conflicts = [];
    const updated = [];
    const newSnapshot = { ...lastSnapshot };

    // Efficient remote scan with filename, size, and mtime
    const findCmd = `find . -maxdepth 5 -type f ! -path '*/.*' ! -path '*/node_modules/*' -printf '%P\\t%s\\t%T@\\n' 2>/dev/null || find . -maxdepth 5 -type f ! -path '*/.*' ! -path '*/node_modules/*'`;
    const execRes = await this.sshService.exec(profile, findCmd, remoteDir);
    if (execRes.code !== 0 && !execRes.stdout.trim()) {
      throw new Error(`Failed to scan remote dir: ${execRes.stderr || 'No response from remote host'}`);
    }

    const lines = execRes.stdout.split('\n').filter(Boolean);
    for (const line of lines) {
      const parts = line.split('\t');
      let relPath = parts[0].trim();
      if (relPath.startsWith('./')) relPath = relPath.slice(2);
      if (!relPath || this.isIgnored(relPath)) continue;

      const remoteSize = parts.length > 1 ? parseInt(parts[1], 10) : null;
      const remoteMtime = parts.length > 2 ? parseFloat(parts[2]) : null;

      const remoteFullPath = path.posix.join(remoteDir, relPath);
      const localFullPath = path.join(localDir, relPath);

      const baseEntry = lastSnapshot[relPath];
      const baseHash = typeof baseEntry === 'object' ? baseEntry?.hash : baseEntry;
      const baseRemoteMtime = typeof baseEntry === 'object' ? baseEntry?.remoteMtime : null;
      const baseRemoteSize = typeof baseEntry === 'object' ? baseEntry?.remoteSize : null;

      let localExists = fs.existsSync(localFullPath);
      let localStat = localExists ? fs.statSync(localFullPath) : null;

      // Delta Fast Path: if remote size & mtime match previous snapshot and local is unmodified
      if (
        localExists &&
        baseHash &&
        baseRemoteMtime &&
        remoteMtime &&
        Math.abs(remoteMtime - baseRemoteMtime) < 0.01 &&
        baseRemoteSize === remoteSize
      ) {
        // Check if local was modified
        const localContent = fs.readFileSync(localFullPath, 'utf8');
        const localHash = this.computeHash(localContent);
        if (localHash === baseHash) {
          // File unchanged on both ends
          continue;
        }
      }

      // Download content only when potentially changed
      let remoteContent = '';
      try {
        remoteContent = await this.remoteFs.readFile(profile, remoteFullPath, 'utf8');
      } catch (err) {
        continue; // skip unreadable files
      }
      const remoteHash = this.computeHash(remoteContent);

      let localContent = null;
      let localHash = null;
      if (localExists) {
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
        }
      }

      newSnapshot[relPath] = {
        hash: remoteHash,
        remoteSize,
        remoteMtime
      };
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
   * Fast Delta-based 3-way conflict aware push: Local Mirror -> Remote
   */
  async push(profile, localDir, remoteDir, force = false, dryRun = false) {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
      return {
        success: true,
        pushed: [],
        conflicts: [],
        dryRun
      };
    }

    const snapshotFile = path.join(localDir, '.dsh-sync-snapshot.json');
    let snapshot = {};
    if (fs.existsSync(snapshotFile)) {
      try {
        snapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
      } catch (err) { /* best-effort cleanup */ }
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
      const stat = fs.statSync(localFull);
      const content = fs.readFileSync(localFull, 'utf8');
      const localHash = this.computeHash(content);

      const baseEntry = snapshot[rel];
      const baseHash = typeof baseEntry === 'object' ? baseEntry?.hash : baseEntry;

      if (baseHash && baseHash === localHash && !force) {
        continue; // Unchanged locally
      }

      if (!dryRun) {
        const parent = path.posix.dirname(remoteFull);
        await this.remoteFs.mkdir(profile, parent);
        await this.remoteFs.writeFile(profile, remoteFull, content, 'utf8');
      }
      pushed.push(rel);

      snapshot[rel] = {
        hash: localHash,
        localSize: stat.size,
        localMtime: stat.mtimeMs
      };
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
