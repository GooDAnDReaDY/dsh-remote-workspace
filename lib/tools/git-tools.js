import { defineTool, genericOutput, resolveWorkspacePath, verifyWorkspaceRealpath } from './shared.js';

// Git status and bootstrap tools (#173: extracted from lib/tools.js)

export function register(deps) {
  const { ctx, sshService, remoteFs, mirrorSync, tunnelService, getActiveProfile, getProfileById, dockerService, diagnoseService, envService, tarSyncService, listProfiles, gitService, bootstrapService, genericOutput, resolveWorkspacePath, verifyWorkspaceRealpath } = deps;

  // 1f. remote_workspace_git_status (#129)
  if (gitService) {
    ctx.tools.register(defineTool({
      name: 'remote_workspace_git_status',
      description: 'Get current Git repository status (branch, modified/untracked files, clean/dirty) in the remote workspace',
      parameters: {
        path: { type: 'string', required: true, description: 'Repository directory path relative to workspace root (use "." for root)' }
      },
      output: genericOutput,
      async execute(args) {
        const profile = getActiveProfile();
        if (!profile) throw new Error('No active remote workspace profile selected');
        const targetPath = (args.path && args.path !== '.')
          ? resolveWorkspacePath(profile.remoteWorkspace, args.path)
          : profile.remoteWorkspace;
        return await gitService.getStatus(profile, targetPath);
      }
    }));
  }
  // 17. remote_workspace_bootstrap (#133)
  if (bootstrapService) {
    ctx.tools.register(defineTool({
      name: 'remote_workspace_bootstrap',
      description: 'Run automated environment bootstrap or init scripts on remote host (Node.js/TypeScript, Python/FastAPI, Docker CE, or custom bash script)',
      parameters: {
        profileId: { type: 'string', required: true, description: 'Remote profile ID (defaults to active profile if empty or "active")' },
        templateId: { type: 'string', description: 'Pre-built template: "nodejs", "python", or "docker"' },
        script: { type: 'string', description: 'Custom bash bootstrap script if templateId is not specified' },
        timeout: { type: 'number', description: 'Execution timeout in seconds (default 300)' }
      },
      output: genericOutput,
      async execute(args) {
        const targetId = args.profileId && args.profileId !== 'active' ? args.profileId : null;
        const profile = (targetId ? getProfileById(targetId) : null) || getActiveProfile();
        if (!profile) throw new Error('Remote profile not found');
        const res = await bootstrapService.runBootstrap(profile, {
          templateId: args.templateId,
          script: args.script,
          timeout: args.timeout
        });
        return res;
      }
    }));
  }
}
