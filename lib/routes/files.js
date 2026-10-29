import { writeJson, readBody, authorizeRequest, validateRemotePath, verifyWorkspaceRealpath } from './helpers.js';
import { contentDisposition, pipeWithProgress, MAX_BYTES } from '../file-transfer.js';
import { patchFile } from '../patch-service.js';

async function transferTarget(req, store, remoteFs) {
  const url = new URL(req.url || '/', 'http://localhost');
  const profileId = url.searchParams.get('profileId') || '';
  const profile = profileId ? store.getProfile(profileId) : store.getActiveProfile();
  if (!profile) {
    const err = new Error('Profile not found');
    err.statusCode = 404;
    err.status = 404;
    throw err;
  }
  const rawFilePath = url.searchParams.get('filePath') || url.searchParams.get('path');
  const workspace = profile.remoteWorkspace && profile.remoteWorkspace.trim() ? profile.remoteWorkspace.trim() : null;
  const filePath = validateRemotePath(rawFilePath, { workspace });
  const verifiedPath = await verifyWorkspaceRealpath(remoteFs, profile, workspace, filePath, rawFilePath);
  return { profile, filePath: verifiedPath };
}

export function registerFileRoutes(sctx, webServer, { remoteFs, store, sshService }) {
  // 7. POST /dsh-remote-workspace/browse (#123: profileId only, no raw profile objects)
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/browse',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const body = await readBody(req);
        let profile = null;
        const profileId = typeof body.profileId === 'string'
          ? body.profileId.trim()
          : (typeof body.profile === 'string'
            ? body.profile.trim()
            : (typeof body.profile?.id === 'string' ? body.profile.id.trim() : null));
        if (profileId) {
          profile = store.getProfile(profileId);
        } else {
          profile = store.getActiveProfile();
        }
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });

        const workspace = profile.remoteWorkspace && profile.remoteWorkspace.trim() ? profile.remoteWorkspace.trim() : null;
        const rawPath = body.remotePath || body.path || workspace || '.';
        const targetPath = validateRemotePath(rawPath, { workspace });
        const verifiedPath = await verifyWorkspaceRealpath(remoteFs, profile, workspace, targetPath, rawPath);
        const entries = await remoteFs.listDir(profile, verifiedPath);
        writeJson(res, 200, { ok: true, entries, items: entries, currentPath: verifiedPath });
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
        const { profileId, filePath, sudo, fallbackSudo } = await readBody(req);
        const profile = profileId ? store.getProfile(profileId) : store.getActiveProfile();
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
        const isSudo = Boolean(sudo || fallbackSudo);
        const workspace = profile.remoteWorkspace && profile.remoteWorkspace.trim() ? profile.remoteWorkspace.trim() : null;
        const targetPath = validateRemotePath(filePath, { workspace, sudo: isSudo });
        const verifiedPath = await verifyWorkspaceRealpath(remoteFs, profile, workspace, targetPath, filePath, { sudo: isSudo });

        let stat = null;
        try {
          stat = await remoteFs.stat(profile, verifiedPath);
          if (stat && stat.size > 2 * 1024 * 1024) {
            return writeJson(res, 400, { ok: false, error: 'File exceeds 2MB preview limit' });
          }
        } catch (statErr) {
          this.lastStatErr = statErr;
        }
        const etag = stat ? `W/"${stat.size}-${stat.mtime}"` : null;
        if (etag && req.headers && req.headers['if-none-match'] === etag) {
          res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' });
          res.end();
          return;
        }
        const buf = await remoteFs.readFile(profile, verifiedPath, 'utf8', 2 * 1024 * 1024, { sudo, fallbackSudo });
        const contentStr = typeof buf === 'string' ? buf : buf.toString('utf8');
        if (etag && !res.headersSent) res.setHeader('ETag', etag);
        writeJson(res, 200, { ok: true, content: contentStr, size: stat?.size ?? Buffer.byteLength(contentStr), etag });
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
        const { profileId, filePath, content, sudo, fallbackSudo } = await readBody(req);
        if (content === undefined) {
          return writeJson(res, 400, { ok: false, error: 'Content is required' });
        }
        const profile = profileId ? store.getProfile(profileId) : store.getActiveProfile();
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
        const isSudo = Boolean(sudo || fallbackSudo);
        const workspace = profile.remoteWorkspace && profile.remoteWorkspace.trim() ? profile.remoteWorkspace.trim() : null;
        const targetPath = validateRemotePath(filePath, { workspace, sudo: isSudo });
        const verifiedPath = await verifyWorkspaceRealpath(remoteFs, profile, workspace, targetPath, filePath, { sudo: isSudo });

        const result = (await remoteFs.writeFile(profile, verifiedPath, content, { sudo, fallbackSudo })) || {};
        writeJson(res, 200, { ok: result.success !== false, ...result });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /file/save');

  // 10. POST /dsh-remote-workspace/file/mkdir
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/file/mkdir',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const body = await readBody(req);
        const profile = (body.profileId ? store.getProfile(body.profileId) : null) || store.getActiveProfile();
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
        const rawPath = body.remotePath || body.path;
        const workspace = profile.remoteWorkspace && profile.remoteWorkspace.trim() ? profile.remoteWorkspace.trim() : null;
        const targetPath = validateRemotePath(rawPath, { workspace });
        const verifiedPath = await verifyWorkspaceRealpath(remoteFs, profile, workspace, targetPath, rawPath);
        await remoteFs.mkdir(profile, verifiedPath, body.recursive ?? true);
        writeJson(res, 200, { ok: true });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /file/mkdir');

  // 11. POST /dsh-remote-workspace/file/remove
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/file/remove',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const body = await readBody(req);
        const profile = (body.profileId ? store.getProfile(body.profileId) : null) || store.getActiveProfile();
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });
        const rawPath = body.remotePath || body.path;
        const workspace = profile.remoteWorkspace && profile.remoteWorkspace.trim() ? profile.remoteWorkspace.trim() : null;
        const targetPath = validateRemotePath(rawPath, { workspace });
        const verifiedPath = await verifyWorkspaceRealpath(remoteFs, profile, workspace, targetPath, rawPath);
        await remoteFs.remove(profile, verifiedPath, body.recursive ?? false);
        writeJson(res, 200, { ok: true });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /file/remove');

  // 12. GET /dsh-remote-workspace/file/download
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/file/download',
    handler: async (req, res) => {
      if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const { profile, filePath } = await transferTarget(req, store, remoteFs);
        const stat = await remoteFs.stat(profile, filePath);
        if (stat.size > MAX_BYTES) {
          const err = new Error(`File exceeds ${MAX_BYTES / (1024 * 1024)}MB download limit`);
          err.status = 413;
          throw err;
        }

        const etag = `W/"${stat.size}-${stat.mtime}"`;
        if (req.headers && req.headers['if-none-match'] === etag) {
          res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' });
          res.end();
          return;
        }

        const stream = await remoteFs.createReadStream(profile, filePath);
        const stop = () => {
          try { stream.destroy(); } catch (err) { this.lastStreamDestroyErr = err; }
        };
        req.on('close', stop);
        stream.on('error', () => stop());
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': stat.size,
          'Content-Disposition': contentDisposition(filePath),
          'Cache-Control': 'no-store',
          ETag: etag
        });
        stream.pipe(res);
      } catch (err) {
        if (!res.headersSent) writeJson(res, err.status || 500, { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /file/download');

  // 13. POST /dsh-remote-workspace/file/upload
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/file/upload',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
      let upload = null;
      try {
        const { profile, filePath } = await transferTarget(req, store, remoteFs);
        upload = await remoteFs.beginUpload(profile, filePath);
        const bytes = await pipeWithProgress(req, upload.stream);
        await upload.commit();
        if (remoteFs.invalidateCache) remoteFs.invalidateCache(profile.id);
        writeJson(res, 200, { ok: true, bytes });
      } catch (err) {
        if (upload) {
          try { await upload.abort(); } catch (abortErr) { this.lastUploadAbortErr = abortErr; }
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
        const destProfile = (destProfileId ? store.getProfile(destProfileId) : null) || store.getActiveProfile();

        if (!srcProfile) return writeJson(res, 404, { ok: false, error: 'Source profile not found' });
        if (!destProfile) return writeJson(res, 404, { ok: false, error: 'Destination profile not found' });
        if (!sourcePath || !destPath) return writeJson(res, 400, { ok: false, error: 'sourcePath and destPath required' });

        const srcWs = srcProfile.remoteWorkspace && srcProfile.remoteWorkspace.trim() ? srcProfile.remoteWorkspace.trim() : null;
        const destWs = destProfile.remoteWorkspace && destProfile.remoteWorkspace.trim() ? destProfile.remoteWorkspace.trim() : null;
        const validatedSrc = validateRemotePath(sourcePath, { workspace: srcWs });
        const verifiedSrc = await verifyWorkspaceRealpath(remoteFs, srcProfile, srcWs, validatedSrc, sourcePath);
        const validatedDest = validateRemotePath(destPath, { workspace: destWs });
        const verifiedDest = await verifyWorkspaceRealpath(remoteFs, destProfile, destWs, validatedDest, destPath);

        const result = await sshService.transferFileBetweenHosts(srcProfile, verifiedSrc, destProfile, verifiedDest);
        writeJson(res, 200, { ok: result.success, ...result });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /transfer');

  // 27. POST /dsh-remote-workspace/file/patch (#126)
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/file/patch',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const body = await readBody(req);
        const profile = (body.profileId ? store.getProfile(body.profileId) : null) || store.getActiveProfile();
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });

        const rawPath = body.filePath || body.path;
        const workspace = profile.remoteWorkspace && profile.remoteWorkspace.trim() ? profile.remoteWorkspace.trim() : null;
        const targetPath = validateRemotePath(rawPath, { workspace });
        const verifiedPath = await verifyWorkspaceRealpath(remoteFs, profile, workspace, targetPath, rawPath);

        const result = await patchFile(profile, remoteFs, verifiedPath, {
          targetContent: body.targetContent,
          replacementContent: body.replacementContent,
          patch: body.patch,
        });

        writeJson(res, 200, { ok: true, ...result });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /file/patch');

  // POST /dsh-remote-workspace/cache/clear (#132)
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/cache/clear',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const body = await readBody(req);
        remoteFs.clearCache(body?.profileId || null);
        writeJson(res, 200, { ok: true, stats: remoteFs.getCacheStats() });
      } catch (err) {
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /cache/clear');
}
