import { writeJson, readBody, isTrustedSettingsRequest, authorizeRequest } from './helpers.js';
import { contentDisposition, pipeWithProgress, MAX_BYTES } from '../file-transfer.js';


function transferTarget(req, store) {
  const url = new URL(req.url || '/', 'http://localhost');
  const profileId = url.searchParams.get('profileId') || '';
  const filePath = url.searchParams.get('filePath') || '';
  if (!filePath || filePath.length > 1024 || filePath.includes('\0')) {
    const err = new Error('A file path is required');
    err.status = 400;
    throw err;
  }
  const profile = profileId ? store.getProfile(profileId) : store.getActiveProfile();
  if (!profile) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }
  return { profile, filePath };
}

export function registerFileRoutes(sctx, webServer, { remoteFs, store, sshService }) {
  // 7. POST /dsh-remote-workspace/browse
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/browse',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
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
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /browse');

  // 8. POST /dsh-remote-workspace/file/view
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/file/view',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
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
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /file/view');

  // 9. POST /dsh-remote-workspace/file/save
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/file/save',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const { profileId, filePath, content } = await readBody(req);
        const profile = store.getProfile(profileId);
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
        await remoteFs.writeFile(profile, filePath, Buffer.from(content, 'utf8'));
        writeJson(res, 200, { ok: true });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /file/save');

  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/file/download',
    handler: async (req, res) => {
      if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const { profile, filePath } = transferTarget(req, store);
        const stat = await remoteFs.stat(profile, filePath);
        if (!stat.isFile) return writeJson(res, 400, { ok: false, error: 'Only a file can be downloaded' });
        if (stat.size > MAX_BYTES) return writeJson(res, 413, { ok: false, error: 'File exceeds the 512MB transfer limit' });
        const stream = await remoteFs.createReadStream(profile, filePath);
        const stop = () => { try { stream.destroy(); } catch (err) { /* best-effort cleanup */ } };
        req.on('close', stop);
        stream.on('error', () => stop());
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': stat.size,
          'Content-Disposition': contentDisposition(filePath),
          'Cache-Control': 'no-store'
        });
        stream.pipe(res);
      } catch (err) {
        if (!res.headersSent) writeJson(res, err.status || 500, { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /file/download');

  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/file/upload',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
      let upload = null;
      try {
        const { profile, filePath } = transferTarget(req, store);
        upload = await remoteFs.beginUpload(profile, filePath);
        const bytes = await pipeWithProgress(req, upload.stream);
        await upload.commit();
        if (remoteFs.invalidateCache) remoteFs.invalidateCache(profile.id);
        writeJson(res, 200, { ok: true, bytes });
      } catch (err) {
        if (upload) {
          try { await upload.abort(); } catch (abortErr) { /* best-effort cleanup */ }
        }
        if (!res.headersSent) {
          const status = err.code === 'ABORTED' ? 499 : (err.code === 'LIMIT' ? 413 : (err.status || 500));
          writeJson(res, status, { ok: false, error: err.message });
        }
      }
    }
  }), 'dsh-remote-workspace: /file/upload');


  // 26. POST /dsh-remote-workspace/transfer
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/transfer',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
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
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /transfer');
}
