import { defineTool, genericOutput, resolveWorkspacePath, verifyWorkspaceRealpath } from './shared.js';
import { shellQuote } from '../tar-sync-service.js';

// Exec / search / service tools (#173: extracted from lib/tools.js)

export function register(deps) {
  const { ctx, sshService, remoteFs, mirrorSync, tunnelService, getActiveProfile, getProfileById, dockerService, diagnoseService, envService, tarSyncService, listProfiles, gitService, bootstrapService, genericOutput, resolveWorkspacePath, verifyWorkspaceRealpath } = deps;

  const executeWorkspaceExec = async (args, defaultTimeout, withBufferCap) => {
    const profile = getActiveProfile();
    if (!profile) throw new Error('No active remote workspace profile selected');
    const dir = args.cwd || profile.remoteWorkspace;
    const timeout = args.timeout !== undefined ? args.timeout : defaultTimeout;
    const cleanAnsi = args.cleanAnsi !== undefined ? args.cleanAnsi : true;
    const maxBufferSize = withBufferCap ? (args.maxBufferSize || 64 * 1024) : undefined;

    const startTime = Date.now();
    const res = await sshService.exec(profile, args.command, {
      cwd: dir,
      timeout,
      maxBufferSize,
      pty: Boolean(args.pty),
      cleanAnsi
    });

    return {
      exitCode: res.code ?? 0,
      stdout: res.stdout,
      stderr: res.stderr,
      executionTimeMs: Date.now() - startTime,
      signal: res.signal
    };
  }
  // 1b. remote_workspace_exec (#124) - canonical exec tool
  ctx.tools.register(defineTool({
    name: 'remote_workspace_exec',
    description: 'Execute shell commands inside the active remote workspace with timeout and buffer capping',
    parameters: {
      command: { type: 'string', required: true, description: 'Command line to execute on remote server' },
      cwd: { type: 'string', description: 'Working directory on remote server (defaults to remote workspace)' },
      timeout: { type: 'number', description: 'Execution timeout in seconds (default 30s)' },
      maxBufferSize: { type: 'number', description: 'Max buffer size in bytes for stdout/stderr before truncation (default 65536)' },
      pty: { type: 'boolean', description: 'Allocate pseudo-terminal for colored or interactive outputs' },
      cleanAnsi: { type: 'boolean', description: 'Strip ANSI escape codes from output for clean LLM context (default true)' }
    },
    output: genericOutput,
    async execute(args) {
      return await executeWorkspaceExec(args, 30, true);
    }
  }));
  // 1. remote_exec - deprecated alias of remote_workspace_exec (#168)
  ctx.tools.register(defineTool({
    name: 'remote_exec',
    description: 'DEPRECATED alias of remote_workspace_exec. Use remote_workspace_exec instead. Executes a bash/shell command on the active remote workspace host (default timeout 60s)',
    parameters: {
      command: { type: 'string', required: true, description: 'Command line to execute on remote server' },
      cwd: { type: 'string', description: 'Working directory on remote server (defaults to remote workspace)' },
      timeout: { type: 'number', description: 'Execution timeout in seconds (default 60s)' },
      pty: { type: 'boolean', description: 'Allocate pseudo-terminal for colored or interactive outputs' },
      cleanAnsi: { type: 'boolean', description: 'Strip ANSI escape codes from output for clean LLM context (default true)' }
    },
    output: genericOutput,
    async execute(args) {
      return await executeWorkspaceExec(args, 60, false);
    }
  }));
  // 1c. remote_workspace_search (#125)
  ctx.tools.register(defineTool({
    name: 'remote_workspace_search',
    description: 'Search text or regex across the remote workspace files using ripgrep or grep',
    parameters: {
      query: { type: 'string', required: true, description: 'Text or regular expression to search for' },
      path: { type: 'string', description: 'Search directory path relative to workspace or absolute' },
      isRegex: { type: 'boolean', description: 'Treat query as a regular expression (default false)' },
      filePattern: { type: 'string', description: 'File pattern filter, e.g. "*.js" or "*.ts"' },
      maxResults: { type: 'number', description: 'Maximum number of matching lines to return (default 50)' }
    },
    output: genericOutput,
    async execute(args) {
      const profile = getActiveProfile();
      if (!profile) throw new Error('No active remote workspace profile selected');
      const targetPath = args.path || profile.remoteWorkspace;

      return await sshService.searchCodebase(profile, {
        query: args.query,
        isRegex: Boolean(args.isRegex),
        path: targetPath,
        filePattern: args.filePattern,
        maxResults: args.maxResults || 50,
      });
    }
  }));
  // 6. remote_service
  ctx.tools.register(defineTool({
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

      const ALLOWED_ACTIONS = ['status', 'start', 'stop', 'restart', 'reload', 'enable', 'disable', 'logs'];
      if (!args.action || !ALLOWED_ACTIONS.includes(args.action)) {
        throw new Error(`Invalid service action: "${args.action}". Allowed actions: ${ALLOWED_ACTIONS.join(', ')}`);
      }

      const mgr = (args.manager || 'systemd').toLowerCase();
      if (!['systemd', 'pm2'].includes(mgr)) {
        throw new Error(`Invalid service manager: "${args.manager}". Allowed managers: systemd, pm2`);
      }

      const svc = args.service;
      if (!svc || typeof svc !== 'string' || svc.trim() === '') {
        throw new Error('Service name is required');
      }

      const lines = Math.max(1, Math.min(10000, parseInt(args.lines, 10) || 40));
      const safeSvc = shellQuote(svc.trim());

      let cmd = '';
      if (mgr === 'pm2') {
        if (args.action === 'logs') cmd = `pm2 logs ${safeSvc} --lines ${lines} --nostream`;
        else cmd = `pm2 ${args.action} ${safeSvc}`;
      } else {
        if (args.action === 'logs') cmd = `journalctl -u ${safeSvc} -n ${lines} --no-pager`;
        else if (args.action === 'status') cmd = `systemctl status ${safeSvc} --no-pager`;
        else cmd = `sudo systemctl ${args.action} ${safeSvc} || systemctl ${args.action} ${safeSvc}`;
      }

      const res = await sshService.exec(profile, cmd, { cleanAnsi: true });
      return {
        exitCode: res.code,
        output: res.stdout || res.stderr
      };
    }
  }));
}
