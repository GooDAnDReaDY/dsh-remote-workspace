import { defineTool, genericOutput, resolveWorkspacePath, verifyWorkspaceRealpath } from './shared.js';

// Diagnostics tool (#173: extracted from lib/tools.js)

export function register(deps) {
  const { ctx, sshService, remoteFs, mirrorSync, tunnelService, getActiveProfile, getProfileById, dockerService, diagnoseService, envService, tarSyncService, listProfiles, gitService, bootstrapService, genericOutput, resolveWorkspacePath, verifyWorkspaceRealpath } = deps;

  // 8. remote_diagnose (New in v0.3.1)
  if (diagnoseService) {
    ctx.tools.register(defineTool({
      name: 'remote_diagnose',
      description: 'Run targeted system health diagnostics on remote host (ports, disk, memory, oom_killer, service_logs)',
      parameters: {
        category: {
          type: 'string',
          required: true,
          description: 'Diagnostic aspect: ports, disk, memory, oom_killer, service_logs'
        },
        target: {
          type: 'string',
          description: 'Optional port number, directory path, or service name to inspect'
        }
      },
      output: genericOutput,
      async execute(args) {
        const profile = getActiveProfile();
        if (!profile) throw new Error('No active remote workspace profile selected');
        return await diagnoseService.diagnose(profile, args.category, args.target);
      }
    }));
  }
}
