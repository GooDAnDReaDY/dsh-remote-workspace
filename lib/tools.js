export function registerRemoteTools(ctx, sshService, remoteFs, mirrorSync, tunnelService, getActiveProfile, getProfileById, dockerService, diagnoseService, envService, tarSyncService) {
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

  // 5. remote_docker
  if (dockerService) {
    ctx.tools.register({
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
    });
  }

  // 6. remote_service
  ctx.tools.register({
    name: 'remote_service',
    description: 'Inspect and manage Linux systemd or PM2 services on the remote machine',
    parameters: {
      action: { type: 'string', required: true, description: 'status, start, stop, restart, logs' },
      service: { type: 'string', required: true, description: 'Service name (e.g. nginx, redis, my-app)' },
      manager: { type: 'string', description: 'systemd (default) or pm2' },
      lines: { type: 'number', description: 'Number of log lines for logs action (default 40)' }
    },
    output: genericOutput,
    async execute(args) {
      const profile = getActiveProfile();
      if (!profile) throw new Error('No active remote workspace profile selected');

      const mgr = args.manager || 'systemd';
      const svc = args.service;
      const lines = args.lines || 40;

      let cmd = '';
      if (mgr === 'pm2') {
        if (args.action === 'logs') cmd = `pm2 logs ${JSON.stringify(svc)} --lines ${lines} --nostream`;
        else cmd = `pm2 ${args.action} ${JSON.stringify(svc)}`;
      } else {
        if (args.action === 'logs') cmd = `journalctl -u ${JSON.stringify(svc)} -n ${lines} --no-pager`;
        else if (args.action === 'status') cmd = `systemctl status ${JSON.stringify(svc)} --no-pager`;
        else cmd = `sudo systemctl ${args.action} ${JSON.stringify(svc)} || systemctl ${args.action} ${JSON.stringify(svc)}`;
      }

      const res = await sshService.exec(profile, cmd, { cleanAnsi: true });
      return {
        exitCode: res.code,
        output: res.stdout || res.stderr
      };
    }
  });

  // 7. remote_transfer
  ctx.tools.register({
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

      return await sshService.transferFileBetweenHosts(srcProfile, args.sourcePath, destProfile, args.destPath);
    }
  });

  // 8. remote_diagnose (New in v0.3.1)
  if (diagnoseService) {
    ctx.tools.register({
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
    });
  }

  // 9. remote_env (New in v0.3.1)
  if (envService) {
    ctx.tools.register({
      name: 'remote_env',
      description: 'Inspect and atomically update remote .env files preserving comments and structure',
      parameters: {
        action: {
          type: 'string',
          required: true,
          description: 'Action to perform: read or set'
        },
        filePath: {
          type: 'string',
          required: true,
          description: 'Path to the .env file on the remote server'
        },
        key: {
          type: 'string',
          description: 'Environment variable key (required for set)'
        },
        value: {
          type: 'string',
          description: 'Environment variable value (for set action)'
        }
      },
      output: genericOutput,
      async execute(args) {
        const profile = getActiveProfile();
        if (!profile) throw new Error('No active remote workspace profile selected');

        if (args.action === 'read') {
          return await envService.readEnv(profile, args.filePath);
        } else if (args.action === 'set') {
          if (!args.key) throw new Error('key is required for set action');
          return await envService.setEnvVar(profile, args.filePath, args.key, args.value || '');
        } else {
          throw new Error(`Unknown env action: ${args.action}`);
        }
      }
    });
  }
}
