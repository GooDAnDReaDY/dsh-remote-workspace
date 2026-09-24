import { writeJson, readBody, isTrustedSettingsRequest } from './helpers.js';

export function registerFileRoutes(sctx, webServer, { remoteFs, store, sshService }) {
  // 7. POST /dsh-remote-workspace/browse
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/browse',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
      try {
        const body = await readBody(req);
        let profile = null;
        if (body.profileId) {
          profile = store.getProfile(body.profileId);
        } else if (typeof body.profile === 'string') {
          profile = store.getProfile(body.profile);
        } else if (body.profile && typeof body.profile === 'object' && body.profile.host) {
          profile = body.profile;
        } else if (body.profile?.id) {
          profile = store.getProfile(body.profile.id);
        } else {
          profile = store.getActiveProfile();
        }
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });

        const targetPath = body.remotePath || body.path || profile.remoteWorkspace || profile.remotePath || '.';
        const entries = await remoteFs.listDir(profile, targetPath);
        writeJson(res, 200, { ok: true, entries, items: entries, currentPath: targetPath });
      } catch (err) {
        writeJson(res, 500, { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /browse');

  // 8. POST /dsh-remote-workspace/file/view
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/file/view',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
      try {
        const { profileId, filePath } = await readBody(req);
        const profile = store.getProfile(profileId);
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
        const stat = await remoteFs.stat(profile, filePath);
        if (stat.size > 2 * 1024 * 1024) {
          return writeJson(res, 400, { ok: false, error: 'File exceeds 2MB preview limit' });
        }
        const buf = await remoteFs.readFile(profile, filePath);
        writeJson(res, 200, { ok: true, content: buf.toString('utf8'), size: stat.size });
      } catch (err) {
        writeJson(res, 500, { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /file/view');

  // 9. POST /dsh-remote-workspace/file/save
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/file/save',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
      try {
        const { profileId, filePath, content } = await readBody(req);
        const profile = store.getProfile(profileId);
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
        await remoteFs.writeFile(profile, filePath, Buffer.from(content, 'utf8'));
        writeJson(res, 200, { ok: true });
      } catch (err) {
        writeJson(res, 500, { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /file/save');

  // 26. POST /dsh-remote-workspace/transfer
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/transfer',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
      try {
        const { sourceProfileId, sourcePath, destProfileId, destPath } = await readBody(req);
        const srcProfile = sourceProfileId ? store.getProfile(sourceProfileId) : store.getActiveProfile();
        const destProfile = store.getProfile(destProfileId);

        if (!srcProfile) return writeJson(res, 404, { ok: false, error: 'Source profile not found' });
        if (!destProfile) return writeJson(res, 404, { ok: false, error: 'Destination profile not found' });
        if (!sourcePath || !destPath) return writeJson(res, 400, { ok: false, error: 'sourcePath and destPath required' });

        const result = await sshService.transferFileBetweenHosts(srcProfile, sourcePath, destProfile, destPath);
        writeJson(res, 200, { ok: result.success, ...result });
      } catch (err) {
        writeJson(res, 500, { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /transfer');
}
