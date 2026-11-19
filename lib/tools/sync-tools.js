import { defineTool, genericOutput, resolveWorkspacePath, verifyWorkspaceRealpath } from './shared.js';

// Mirror sync tool (#173: extracted from lib/tools.js)

export function register(deps) {
  const { ctx, sshService, remoteFs, mirrorSync, tunnelService, getActiveProfile, getProfileById, dockerService, diagnoseService, envService, tarSyncService, listProfiles, gitService, bootstrapService, genericOutput, resolveWorkspacePath, verifyWorkspaceRealpath } = deps;

  // 3. remote_sync
  ctx.tools.register(defineTool({
    name: 'remote_sync',
    description: 'Perform 3-way delta or streaming tarball synchronization between local mirror and remote server',
    parameters: {
      direction: { type: 'string', required: true, description: 'pull (remote -> local) or push (local -> remote)' },
      mode: { type: 'string', description: 'sync mode: delta (default) or tarball (fast batch stream)' },
      force: { type: 'boolean', description: 'Overwrite conflicts if true (use with caution)' },
      dryRun: { type: 'boolean', description: 'Simulate changes without writing files' }
    },
    output: genericOutput,
    async execute(args) {
      const profile = getActiveProfile();
      if (!profile) throw new Error('No active remote workspace profile selected');
      if (!profile.remoteWorkspace || !profile.localMirrorPath) {
        throw new Error('Both remoteWorkspace and localMirrorPath must be configured');
      }

      if (args.mode === 'tarball' && tarSyncService) {
        if (args.direction === 'pull') {
          return await tarSyncService.pullTar(profile, profile.remoteWorkspace, profile.localMirrorPath);
        } else {
          return await tarSyncService.pushTar(profile, profile.localMirrorPath, profile.remoteWorkspace);
        }
      }

      if (args.direction === 'pull') {
        return await mirrorSync.pull(profile, profile.remoteWorkspace, profile.localMirrorPath, args.dryRun);
      } else {
        return await mirrorSync.push(profile, profile.localMirrorPath, profile.remoteWorkspace, args.force, args.dryRun);
      }
    }
  }));
}
