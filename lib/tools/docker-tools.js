import { defineTool, genericOutput, resolveWorkspacePath, verifyWorkspaceRealpath } from './shared.js';
import { shellQuote } from '../tar-sync-service.js';

// Docker tools (#173: extracted from lib/tools.js)

export function register(deps) {
  const { ctx, sshService, remoteFs, mirrorSync, tunnelService, getActiveProfile, getProfileById, dockerService, diagnoseService, envService, tarSyncService, listProfiles, gitService, bootstrapService, genericOutput, resolveWorkspacePath, verifyWorkspaceRealpath } = deps;

  // 5. remote_docker
  if (dockerService) {
    ctx.tools.register(defineTool({
      name: 'remote_docker',
      description: 'Manage Docker/Podman containers and Docker Compose on remote host',
      parameters: {
        action: { type: 'string', required: true, description: 'list, logs, start, stop, restart, compose' },
        containerId: { type: 'string', description: 'Container ID or name' },
        tail: { type: 'number', description: 'Number of log lines to retrieve (default 50)' },
        composeAction: { type: 'string', description: 'Compose action: up -d, down, ps, restart' },
        composeCwd: { type: 'string', description: 'Directory containing docker-compose.yml' }
      },
      output: genericOutput,
      async execute(args) {
        const profile = getActiveProfile();
        if (!profile) throw new Error('No active remote workspace profile selected');

        switch (args.action) {
          case 'list':
            return await dockerService.listContainers(profile, true);
          case 'logs':
            if (!args.containerId) throw new Error('containerId required for logs');
            return await dockerService.containerLogs(profile, args.containerId, args.tail || 50);
          case 'start':
          case 'stop':
          case 'restart':
            if (!args.containerId) throw new Error(`containerId required for ${args.action}`);
            return await dockerService.containerAction(profile, args.containerId, args.action);
          case 'compose':
            const dir = args.composeCwd || profile.remoteWorkspace;
            return await dockerService.composeAction(profile, dir, args.composeAction || 'ps');
          default:
            throw new Error(`Unknown docker action: ${args.action}`);
        }
      }
    }));
  }
  // 18. remote_docker_socket (#135)
  if (dockerService) {
    ctx.tools.register(defineTool({
      name: 'remote_docker_socket',
      description: 'Check availability, forward remote /var/run/docker.sock to local Unix socket or TCP port, or stop forwarding for dsh-docker-dashboard synergy (#135)',
      parameters: {
        action: { type: 'string', required: true, description: 'Action to perform: "check", "forward", "stop", or "status"' },
        profileId: { type: 'string', description: 'Remote profile ID (defaults to active profile)' },
        remoteSocketPath: { type: 'string', description: 'Path to remote Docker socket (defaults to /var/run/docker.sock)' },
        localPort: { type: 'number', description: 'Optional local TCP port to forward to (default: auto-allocated free port)' }
      },
      output: genericOutput,
      async execute(args) {
        const action = String(args.action || 'status').toLowerCase();
        const profile = (args.profileId ? getProfileById(args.profileId) : null) || getActiveProfile();
        if (!profile) throw new Error('Remote profile not found');

        if (action === 'check') {
          return await dockerService.checkDockerSocket(profile, args.remoteSocketPath);
        } else if (action === 'forward') {
          return await dockerService.forwardDockerSocket(profile, {
            remoteSocketPath: args.remoteSocketPath,
            localPort: args.localPort
          });
        } else if (action === 'stop') {
          const stopped = dockerService.stopSocketForward(profile.id);
          return { success: true, profileId: profile.id, stopped };
        } else if (action === 'status') {
          const check = await dockerService.checkDockerSocket(profile, args.remoteSocketPath);
          const forward = dockerService.getSocketStatus(profile.id);
          return { profileId: profile.id, socket: check, forward };
        } else {
          throw new Error(`Unknown action: ${args.action}. Valid: check, forward, stop, status`);
        }
      }
    }));
  }
}
