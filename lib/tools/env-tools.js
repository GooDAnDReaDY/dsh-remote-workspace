import { defineTool, genericOutput, resolveWorkspacePath, verifyWorkspaceRealpath } from './shared.js';

// Remote .env tool (#173: extracted from lib/tools.js)

export function register(deps) {
  const { ctx, sshService, remoteFs, mirrorSync, tunnelService, getActiveProfile, getProfileById, dockerService, diagnoseService, envService, tarSyncService, listProfiles, gitService, bootstrapService, genericOutput, resolveWorkspacePath, verifyWorkspaceRealpath } = deps;

  // 9. remote_env (New in v0.3.1)
  if (envService) {
    ctx.tools.register(defineTool({
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
          description: 'Environment variable key (optional for read to retrieve a specific variable; required for set)'
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
          const res = await envService.readEnv(profile, args.filePath);
          if (args.key) {
            const entry = (res.entries || []).find((e) => e.key === args.key);
            const val = entry ? entry.value : (res.variables ? res.variables[args.key] : undefined);
            return {
              filePath: res.filePath || args.filePath,
              key: args.key,
              exists: entry !== undefined || (res.variables && res.variables[args.key] !== undefined),
              value: val !== undefined ? val : null
            };
          }
          const keys = res.entries
            ? res.entries.filter((e) => e.key).map((e) => e.key)
            : (res.variables ? Object.keys(res.variables) : []);
          const sanitizedEntries = (res.entries || []).map((e) => ({
            key: e.key,
            isComment: Boolean(e.isComment),
            hasValue: Boolean(e.value),
            value: e.value ? '••••••••' : ''
          }));
          return {
            filePath: res.filePath || args.filePath,
            keys,
            entries: sanitizedEntries,
            note: 'Values are masked to prevent secret leakage into LLM context. Pass "key" argument to read a specific variable.'
          };
        } else if (args.action === 'set') {
          if (!args.key) throw new Error('key is required for set action');
          return await envService.setEnvVar(profile, args.filePath, args.key, args.value || '');
        } else {
          throw new Error(`Unknown env action: ${args.action}`);
        }
      }
    }));

  }
}
