import { defineTool, genericOutput, resolveWorkspacePath, verifyWorkspaceRealpath } from './shared.js';

// Tunnel tools (#173: extracted from lib/tools.js)

export function register(deps) {
  const { ctx, sshService, remoteFs, mirrorSync, tunnelService, getActiveProfile, getProfileById, dockerService, diagnoseService, envService, tarSyncService, listProfiles, gitService, bootstrapService, genericOutput, resolveWorkspacePath, verifyWorkspaceRealpath } = deps;

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
  }
  // 1e. remote_workspace_tunnel (#127) - canonical tunnel tool
  ctx.tools.register(defineTool({
    name: 'remote_workspace_tunnel',
    description: 'Open, close, or list local port forwarding tunnels and HTTP proxy endpoints to the remote server',
    parameters: {
      action: { type: 'string', required: true, description: 'Tunnel action: "open", "close", or "list"' },
      remotePort: { type: 'number', description: 'Remote port to forward (required for "open")' },
      localPort: { type: 'number', description: 'Local port to bind to (optional for "open", auto-allocated if omitted)' },
      targetHost: { type: 'string', description: 'Target host on the remote network (default "127.0.0.1")' },
      tunnelId: { type: 'string', description: 'Tunnel identifier (required for "close")' }
    },
    output: genericOutput,
    async execute(args) {
      return await executeWorkspaceTunnel(args);
    }
  }));
  // 4. remote_tunnel - deprecated alias of remote_workspace_tunnel (#168)
  ctx.tools.register(defineTool({
    name: 'remote_tunnel',
    description: 'DEPRECATED alias of remote_workspace_tunnel. Use remote_workspace_tunnel instead. Manages SSH port forwarding tunnels (start/stop/list)',
    parameters: {
      action: { type: 'string', required: true, description: 'start, stop, or list' },
      localPort: { type: 'number', description: 'Local listening port' },
      remotePort: { type: 'number', description: 'Remote destination port' },
      tunnelId: { type: 'string', description: 'Tunnel ID to stop' }
    },
    output: genericOutput,
    async execute(args) {
      return await executeWorkspaceTunnel(args);
    }
  }));
}
