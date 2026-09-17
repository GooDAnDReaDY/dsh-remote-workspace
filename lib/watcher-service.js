import fs from 'node:fs';
import path from 'node:path';

export class WatcherService {
  constructor() {
    /** @type {Map<string, { watcher: fs.FSWatcher, profile: any, running: boolean }>} */
    this.watchers = new Map();
    /** @type {Map<string, NodeJS.Timeout>} */
    this.debounceTimers = new Map();
    this.debounceMs = 350;
    this.onSyncCallback = null;
  }

  setOnSync(cb) {
    this.onSyncCallback = cb;
  }

  isIgnored(filename) {
    if (!filename) return true;
    const parts = filename.split(/[\\/]/);
    const ignoreList = ['.git', 'node_modules', '.dsh-sync-snapshot.json', '.cache', 'dist', 'build', '.next'];
    for (const part of parts) {
      if (ignoreList.includes(part)) return true;
      if (part.endsWith('.tmp') || part.endsWith('.swp') || part.endsWith('~')) return true;
    }
    return false;
  }

  start(profile, mirrorSync) {
    if (!profile || !profile.id || !profile.localMirrorPath || !profile.remoteWorkspace) {
      return { success: false, error: 'Both localMirrorPath and remoteWorkspace must be set' };
    }

    if (this.watchers.has(profile.id)) {
      return { success: true, alreadyRunning: true };
    }

    if (!fs.existsSync(profile.localMirrorPath)) {
      try {
        fs.mkdirSync(profile.localMirrorPath, { recursive: true });
      } catch (err) {
        return { success: false, error: `Failed to create local mirror dir: ${err.message}` };
      }
    }

    try {
      const watcher = fs.watch(profile.localMirrorPath, { recursive: true }, (_eventType, filename) => {
        if (!filename || this.isIgnored(filename)) return;

        // Debounce sync triggers
        if (this.debounceTimers.has(profile.id)) {
          clearTimeout(this.debounceTimers.get(profile.id));
        }

        const timer = setTimeout(async () => {
          this.debounceTimers.delete(profile.id);
          try {
            const syncRes = await mirrorSync.push(profile, profile.localMirrorPath, profile.remoteWorkspace);
            if (this.onSyncCallback) {
              this.onSyncCallback({ profileId: profile.id, syncRes });
            }
          } catch (err) { /* best-effort cleanup */ }
        }, this.debounceMs);

        this.debounceTimers.set(profile.id, timer);
      });

      this.watchers.set(profile.id, { watcher, profile, running: true });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  stop(profileId) {
    if (this.debounceTimers.has(profileId)) {
      clearTimeout(this.debounceTimers.get(profileId));
      this.debounceTimers.delete(profileId);
    }
    const item = this.watchers.get(profileId);
    if (item) {
      try {
        item.watcher.close();
      } catch (err) { /* best-effort cleanup */ }
      this.watchers.delete(profileId);
      return true;
    }
    return false;
  }

  getStatus(profileId) {
    return this.watchers.has(profileId);
  }

  listActive() {
    return Array.from(this.watchers.keys());
  }

  stopAll() {
    for (const [id, item] of this.watchers.entries()) {
      try {
        item.watcher.close();
      } catch (err) { /* best-effort cleanup */ }
      if (this.debounceTimers.has(id)) {
        clearTimeout(this.debounceTimers.get(id));
      }
    }
    this.watchers.clear();
    this.debounceTimers.clear();
  }
}
