import { defineTool, genericOutput, resolveWorkspacePath, verifyWorkspaceRealpath } from './shared.js';
import { patchFile } from '../patch-service.js';
import path from 'node:path';

// Filesystem / patch / transfer tools (#173: extracted from lib/tools.js)

export function register(deps) {
  const { ctx, sshService, remoteFs, mirrorSync, tunnelService, getActiveProfile, getProfileById, dockerService, diagnoseService, envService, tarSyncService, listProfiles, gitService, bootstrapService, genericOutput, resolveWorkspacePath, verifyWorkspaceRealpath } = deps;

  // 1d. remote_workspace_patch_file (#126)
  ctx.tools.register(defineTool({
    name: 'remote_workspace_patch_file',
    description: 'Safely modify a remote file using search-and-replace blocks or unified diff format with automatic backup and uniqueness validation',
    parameters: {
      path: { type: 'string', required: true, description: 'File path relative to remote workspace or absolute' },
      targetContent: { type: 'string', description: 'Exact string or code block to search and replace (must match uniquely)' },
      replacementContent: { type: 'string', description: 'New string or code block to replace targetContent with' },
      patch: { type: 'string', description: 'Unified diff patch string to apply to the file' }
    },
    output: genericOutput,
    async execute(args) {
      const profile = getActiveProfile();
      if (!profile) throw new Error('No active remote workspace profile selected');
      if (!args.path) throw new Error('File path is required');

      const resolved = resolveWorkspacePath(profile.remoteWorkspace, args.path);
      const verified = await verifyWorkspaceRealpath(remoteFs, profile, profile.remoteWorkspace, resolved, args.path);

      return await patchFile(profile, remoteFs, verified, {
        targetContent: args.targetContent,
        replacementContent: args.replacementContent,
        patch: args.patch,
      });
    }
  }));

  // #168: one tunnel implementation; remote_tunnel stays as a deprecated alias.
  const executeWorkspaceTunnel = async (args) => {
    const profile = getActiveProfile();
    if (!profile) throw new Error('No active remote workspace profile selected');
    const action = (args.action || '').trim().toLowerCase();

    if (action === 'open' || action === 'start') {
      const rPort = parseInt(args.remotePort, 10);
      if (!rPort || isNaN(rPort) || rPort <= 0) {
        throw new Error('Valid remotePort is required for open action');
      }
      return await tunnelService.openTunnel(profile, rPort, args.localPort || 0, args.targetHost || '127.0.0.1');
    }

    if (action === 'close' || action === 'stop') {
      if (!args.tunnelId) throw new Error('tunnelId is required for close action');
      const closed = tunnelService.stopTunnel(args.tunnelId);
      return { ok: closed, tunnelId: args.tunnelId, success: closed };
    }

    if (action === 'list') {
      return {
        ok: true,
        tunnels: tunnelService.listActiveTunnels(),
      };
    }

    throw new Error(`Invalid tunnel action "${args.action}". Allowed: open, close, list`);
  };
  // 2. remote_fs
  ctx.tools.register(defineTool({
    name: 'remote_fs',
    description: 'Perform file operations (read, write, stat, list, mkdir, remove) on remote workspace with caching and optional sudo root elevation',
    parameters: {
      action: {
        type: 'string',
        required: true,
        description: 'Filesystem operation: read, write, stat, list, mkdir, remove'
      },
      path: { type: 'string', required: true, description: 'Absolute or workspace-relative remote path' },
      content: { type: 'string', description: 'Content for write action' },
      recursive: { type: 'boolean', description: 'Recursive flag for remove action' },
      bypassCache: { type: 'boolean', description: 'Bypass in-memory cache for fresh results' },
      sudo: { type: 'boolean', description: 'Execute operation with root privilege elevation (sudo -n)' }
    },
    output: genericOutput,
    async execute(args) {
      const profile = getActiveProfile();
      if (!profile) throw new Error('No active remote workspace profile selected');
      const { action, path: targetPath, content, recursive, bypassCache, sudo } = args;

      let resolvedPath;
      const isSudo = Boolean(sudo);
      if (isSudo && path.posix.isAbsolute(targetPath)) {
        resolvedPath = path.posix.normalize(targetPath);
      } else {
        const lexicalPath = resolveWorkspacePath(profile.remoteWorkspace, targetPath);
        const normWs = path.posix.normalize(profile.remoteWorkspace.trim());
        if (action === 'remove' && lexicalPath === normWs) {
          throw new Error('Cannot remove root workspace directory');
        }
        resolvedPath = await verifyWorkspaceRealpath(remoteFs, profile, profile.remoteWorkspace, lexicalPath, targetPath);
        if (action === 'remove' && resolvedPath === normWs) {
          throw new Error('Cannot remove root workspace directory');
        }
      }

      switch (action) {
        case 'read': {
          const data = await remoteFs.readFile(profile, resolvedPath, 'utf8', 20 * 1024 * 1024, { sudo: isSudo });
          return { content: data };
        }
        case 'write': {
          if (content === undefined) throw new Error('Content is required for write action');
          const res = await remoteFs.writeFile(profile, resolvedPath, content, 'utf8', { sudo: isSudo });
          return res;
        }
        case 'stat': {
          return await remoteFs.stat(profile, resolvedPath, Boolean(bypassCache));
        }
        case 'list': {
          const entries = await remoteFs.listDir(profile, resolvedPath, Boolean(bypassCache));
          return { entries };
        }
        case 'mkdir': {
          return await remoteFs.mkdir(profile, resolvedPath, { sudo: isSudo });
        }
        case 'remove': {
          return await remoteFs.remove(profile, resolvedPath, recursive, { sudo: isSudo });
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }
  }));
  // 7. remote_transfer
  ctx.tools.register(defineTool({
    name: 'remote_transfer',
    description: 'Transfer a file directly between two configured remote servers via in-memory SFTP streams',
    parameters: {
      sourcePath: { type: 'string', required: true, description: 'File path on the source remote server' },
      destPath: { type: 'string', required: true, description: 'File path on the destination remote server' },
      destProfileId: { type: 'string', required: true, description: 'Target remote profile ID' },
      sourceProfileId: { type: 'string', description: 'Source remote profile ID (defaults to active profile)' }
    },
    output: genericOutput,
    async execute(args) {
      const srcProfile = args.sourceProfileId && getProfileById ? getProfileById(args.sourceProfileId) : getActiveProfile();
      if (!srcProfile) throw new Error('Source profile not found or no active profile');

      const destProfile = getProfileById ? getProfileById(args.destProfileId) : null;
      if (!destProfile) throw new Error(`Destination profile "${args.destProfileId}" not found`);

      // #161: both paths go through the shared workspace path-guard, exactly
      // like the HTTP /transfer route. Tool variant requires a configured
      // workspace on both profiles.
      const srcWs = srcProfile.remoteWorkspace && srcProfile.remoteWorkspace.trim() ? srcProfile.remoteWorkspace.trim() : null;
      const destWs = destProfile.remoteWorkspace && destProfile.remoteWorkspace.trim() ? destProfile.remoteWorkspace.trim() : null;
      const srcPath = resolveWorkspacePath(srcWs, args.sourcePath);
      const verifiedSrc = await verifyWorkspaceRealpath(remoteFs, srcProfile, srcWs, srcPath, args.sourcePath);
      const destPath = resolveWorkspacePath(destWs, args.destPath);
      const verifiedDest = await verifyWorkspaceRealpath(remoteFs, destProfile, destWs, destPath, args.destPath);

      return await sshService.transferFileBetweenHosts(srcProfile, verifiedSrc, destProfile, verifiedDest);
    }
  }));
}
