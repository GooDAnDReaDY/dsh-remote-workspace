export function registerRemoteTools(ctx, sshService, remoteFs, mirrorSync, tunnelService, getActiveProfile) {
  if (!ctx.tools || typeof ctx.tools.register !== 'function') {
    return;
  }

  const genericOutput = {
    schema: { type: 'object' },
    render: (_args, value) => ({ type: 'text', content: typeof value === 'string' ? value : JSON.stringify(value, null, 2) })
  };

  // 1. remote_exec
  ctx.tools.register({
    name: 'remote_exec',
    description: 'Execute bash/shell command on the active remote workspace host with timeout and ANSI cleaning',
    parameters: {
      command: { type: 'string', required: true, description: 'Command line to execute on remote server' },
      cwd: { type: 'string', description: 'Working directory on remote server (defaults to remote workspace)' },
      timeout: { type: 'number', description: 'Execution timeout in seconds (default 60s, 0 to disable)' },
      pty: { type: 'boolean', description: 'Allocate pseudo-terminal for colored or interactive outputs' },
      cleanAnsi: { type: 'boolean', description: 'Strip ANSI escape codes from output for clean LLM context (default true)' }
    },
    output: genericOutput,
    async execute(args) {
      const profile = getActiveProfile();
      if (!profile) throw new Error('No active remote workspace profile selected');
      const dir = args.cwd || profile.remoteWorkspace;
      const timeout = args.timeout !== undefined ? args.timeout : 60;
      const cleanAnsi = args.cleanAnsi !== undefined ? args.cleanAnsi : true;

      const res = await sshService.exec(profile, args.command, {
        cwd: dir,
        timeout,
        pty: Boolean(args.pty),
        cleanAnsi
      });

      return {
        exitCode: res.code,
        stdout: res.stdout,
        stderr: res.stderr,
        signal: res.signal
      };
    }
  });

  // 2. remote_fs
  ctx.tools.register({
    name: 'remote_fs',
    description: 'Perform file operations (read, write, stat, list, mkdir, remove) on remote workspace with caching',
    parameters: {
      action: {
        type: 'string',
        required: true,
        description: 'Filesystem operation: read, write, stat, list, mkdir, remove'
      },
      path: { type: 'string', required: true, description: 'Absolute or workspace-relative remote path' },
      content: { type: 'string', description: 'Content for write action' },
      recursive: { type: 'boolean', description: 'Recursive flag for remove action' },
      bypassCache: { type: 'boolean', description: 'Bypass in-memory cache for fresh results' }
    },
    output: genericOutput,
    async execute(args) {
      const profile = getActiveProfile();
      if (!profile) throw new Error('No active remote workspace profile selected');
      const { action, path: targetPath, content, recursive, bypassCache } = args;

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
          return await remoteFs.stat(profile, targetPath, Boolean(bypassCache));
        }
        case 'list': {
          const entries = await remoteFs.listDir(profile, targetPath, Boolean(bypassCache));
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
  ctx.tools.register({
    name: 'remote_sync',
    description: 'Perform fast 3-way delta synchronization between local mirror and remote server',
    parameters: {
      direction: { type: 'string', required: true, description: 'pull (remote -> local) or push (local -> remote)' },
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

      if (args.direction === 'pull') {
        return await mirrorSync.pull(profile, profile.remoteWorkspace, profile.localMirrorPath, args.dryRun);
      } else {
        return await mirrorSync.push(profile, profile.localMirrorPath, profile.remoteWorkspace, args.force, args.dryRun);
      }
    }
  });

  // 4. remote_tunnel
  ctx.tools.register({
    name: 'remote_tunnel',
    description: 'Manage SSH port forwarding tunnels (start, stop, list) with telemetry metrics',
    parameters: {
      action: { type: 'string', required: true, description: 'start, stop, or list' },
      localPort: { type: 'number', description: 'Local listening port' },
      remotePort: { type: 'number', description: 'Remote destination port' },
      tunnelId: { type: 'string', description: 'Tunnel ID to stop' }
    },
    output: genericOutput,
    async execute(args) {
      const profile = getActiveProfile();
      if (!profile && args.action !== 'list' && args.action !== 'stop') {
        throw new Error('No active remote workspace profile selected');
      }

      if (args.action === 'list') {
        return { tunnels: tunnelService.listActiveTunnels() };
      }
      if (args.action === 'start') {
        if (!args.localPort || !args.remotePort) throw new Error('localPort and remotePort required to start tunnel');
        return await tunnelService.startLocalTunnel(profile, args.localPort, '127.0.0.1', args.remotePort);
      }
      if (args.action === 'stop') {
        if (!args.tunnelId) throw new Error('tunnelId required to stop tunnel');
        const ok = tunnelService.stopTunnel(args.tunnelId);
        return { success: ok };
      }
    }
  });
}
