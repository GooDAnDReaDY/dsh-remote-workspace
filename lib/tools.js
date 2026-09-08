export function registerRemoteTools(ctx, sshService, remoteFs, mirrorSync, tunnelService, getActiveProfile) {
  if (!ctx.tools || typeof ctx.tools.register !== 'function') {
    return;
  }

  // 1. remote_exec
  ctx.tools.register('remote_exec', {
    description: 'Execute bash/shell command on the active remote workspace host',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command line to execute on remote server' },
        cwd: { type: 'string', description: 'Working directory on remote server (defaults to remote workspace)' }
      },
      required: ['command']
    },
    async execute({ command, cwd }) {
      const profile = getActiveProfile();
      if (!profile) throw new Error('No active remote workspace profile selected');
      const dir = cwd || profile.remoteWorkspace;
      const res = await sshService.exec(profile, command, dir);
      return {
        exitCode: res.code,
        stdout: res.stdout,
        stderr: res.stderr
      };
    }
  });

  // 2. remote_fs
  ctx.tools.register('remote_fs', {
    description: 'Perform file operations (read, write, stat, list, mkdir, remove) on remote workspace',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['read', 'write', 'stat', 'list', 'mkdir', 'remove'],
          description: 'Filesystem operation'
        },
        path: { type: 'string', description: 'Absolute or workspace-relative remote path' },
        content: { type: 'string', description: 'Content for write action' },
        recursive: { type: 'boolean', description: 'Recursive flag for remove action' }
      },
      required: ['action', 'path']
    },
    async execute({ action, path: targetPath, content, recursive }) {
      const profile = getActiveProfile();
      if (!profile) throw new Error('No active remote workspace profile selected');

      switch (action) {
        case 'read': {
          const data = await remoteFs.readFile(profile, targetPath, 'utf8');
          return { content: data };
        }
        case 'write': {
          if (content === undefined) throw new Error('Content is required for write action');
          const res = await remoteFs.writeFile(profile, targetPath, content, 'utf8');
          return res;
        }
        case 'stat': {
          return await remoteFs.stat(profile, targetPath);
        }
        case 'list': {
          const entries = await remoteFs.listDir(profile, targetPath);
          return { entries };
        }
        case 'mkdir': {
          return await remoteFs.mkdir(profile, targetPath);
        }
        case 'remove': {
          return await remoteFs.remove(profile, targetPath, recursive);
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }
  });

  // 3. remote_sync
  ctx.tools.register('remote_sync', {
    description: 'Perform 3-way conflict-aware synchronization between local mirror and remote server',
    parameters: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['pull', 'push'], description: 'pull (remote -> local) or push (local -> remote)' },
        force: { type: 'boolean', description: 'Overwrite conflicts if true (use with caution)' },
        dryRun: { type: 'boolean', description: 'Simulate changes without writing files' }
      },
      required: ['direction']
    },
    async execute({ direction, force, dryRun }) {
      const profile = getActiveProfile();
      if (!profile) throw new Error('No active remote workspace profile selected');
      if (!profile.remoteWorkspace || !profile.localMirrorPath) {
        throw new Error('Both remoteWorkspace and localMirrorPath must be configured');
      }

      if (direction === 'pull') {
        return await mirrorSync.pull(profile, profile.remoteWorkspace, profile.localMirrorPath, dryRun);
      } else {
        return await mirrorSync.push(profile, profile.localMirrorPath, profile.remoteWorkspace, force, dryRun);
      }
    }
  });

  // 4. remote_tunnel
  ctx.tools.register('remote_tunnel', {
    description: 'Manage SSH port forwarding tunnels (start, stop, list)',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['start', 'stop', 'list'], description: 'Tunnel action' },
        localPort: { type: 'number', description: 'Local listening port' },
        remotePort: { type: 'number', description: 'Remote destination port' },
        tunnelId: { type: 'string', description: 'Tunnel ID to stop' }
      },
      required: ['action']
    },
    async execute({ action, localPort, remotePort, tunnelId }) {
      const profile = getActiveProfile();
      if (!profile && action !== 'list' && action !== 'stop') {
        throw new Error('No active remote workspace profile selected');
      }

      if (action === 'list') {
        return { tunnels: tunnelService.listActiveTunnels() };
      }
      if (action === 'start') {
        if (!localPort || !remotePort) throw new Error('localPort and remotePort required to start tunnel');
        return await tunnelService.startLocalTunnel(profile, localPort, '127.0.0.1', remotePort);
      }
      if (action === 'stop') {
        if (!tunnelId) throw new Error('tunnelId required to stop tunnel');
        const ok = tunnelService.stopTunnel(tunnelId);
        return { success: ok };
      }
    }
  });
}
