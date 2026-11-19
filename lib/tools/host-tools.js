import { defineTool, genericOutput, resolveWorkspacePath, verifyWorkspaceRealpath } from './shared.js';
import { renderHostTable } from '../host-projection.js';
import { filterClusterProfiles, runCluster } from '../cluster-service.js';

// Host listing and cluster tools (#173: extracted from lib/tools.js)

export function register(deps) {
  const { ctx, sshService, remoteFs, mirrorSync, tunnelService, getActiveProfile, getProfileById, dockerService, diagnoseService, envService, tarSyncService, listProfiles, gitService, bootstrapService, genericOutput, resolveWorkspacePath, verifyWorkspaceRealpath } = deps;

  // 16. remote_cluster / remote_hosts (#168: registered independently of envService)
  ctx.tools.register(defineTool({
    name: 'remote_cluster',
    description: 'Run one command on many hosts filtered by alias, environment, or tags',
    parameters: {
      command: { type: 'string', required: true, description: 'Shell command to run on each selected host' },
      environment: { type: 'string', description: 'Only hosts in this environment' },
      tags: { type: 'string', description: 'Comma-separated tags; every tag must match' },
      aliases: { type: 'string', description: 'Comma-separated host ids or names' },
      maxWorkers: { type: 'number', description: 'Parallel host limit, default 8' }
    },
    output: genericOutput,
    async execute(args) {
      const profiles = typeof listProfiles === 'function' ? (listProfiles() || []) : [];
      const selected = filterClusterProfiles(profiles, {
        environment: args.environment,
        tags: String(args.tags || '').split(',').map((item) => item.trim()).filter(Boolean),
        aliases: String(args.aliases || '').split(',').map((item) => item.trim()).filter(Boolean)
      });
      const results = await runCluster(selected, args.command, {
        maxWorkers: args.maxWorkers,
        exec: (profile, command) => sshService.exec(profile, command, { timeout: 60, cleanAnsi: true })
      });
      return { count: results.length, results };
    }
  }));

  ctx.tools.register(defineTool({
    name: 'remote_hosts',
    description: 'List configured remote hosts as a compact table without secrets or bastion commands',
    parameters: {
      query: { type: 'string', required: true, description: 'Text matched against alias, host, environment, or tags. Pass an empty string to list every host.' }
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{
        type: 'text',
        text: value && value.table ? value.table : ''
      }]
    },
    async execute(args) {
      const profiles = typeof listProfiles === 'function' ? (listProfiles() || []) : [];
      const query = String(args.query || '').trim().toLowerCase();
      const matched = query
        ? profiles.filter((profile) => {
            const haystack = [profile.name, profile.host, profile.environment, ...(profile.tags || [])].join(' ').toLowerCase();
            return haystack.includes(query);
          })
        : profiles;
      return { count: matched.length, table: renderHostTable(matched) };
    }
  }));
}
