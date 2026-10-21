import { writeJson, readBody, authorizeRequest, validateRemotePath } from './helpers.js';

export function registerExecRoutes(sctx, webServer, { store, sshService }) {
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/exec',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!authorizeRequest(sctx, req, res)) return;
      try {
        const body = await readBody(req);
        const profileId = body.profileId;
        const profile = profileId ? store.getProfile(profileId) : store.getActiveProfile();
        if (!profile) return writeJson(res, 404, { ok: false, error: 'Profile not found' });

        const command = body.command;
        if (!command || typeof command !== 'string' || !command.trim()) {
          return writeJson(res, 400, { ok: false, error: 'command is required' });
        }

        const rawCwd = body.cwd || profile.remoteWorkspace || '.';
        const targetCwd = validateRemotePath(rawCwd);
        const timeout = typeof body.timeout === 'number' && body.timeout > 0 ? body.timeout : 30;
        const maxBufferSize = typeof body.maxBufferSize === 'number' && body.maxBufferSize > 0 ? body.maxBufferSize : 64 * 1024;

        const startTime = Date.now();
        const result = await sshService.exec(profile, command, {
          cwd: targetCwd,
          timeout,
          maxBufferSize,
          cleanAnsi: body.cleanAnsi !== false,
          pty: Boolean(body.pty),
        });

        writeJson(res, 200, {
          ok: true,
          exitCode: result.code ?? 0,
          stdout: result.stdout,
          stderr: result.stderr,
          executionTimeMs: Date.now() - startTime,
        });
      } catch (err) {
        if (err.code === 'COMMAND_TIMEOUT') {
          return writeJson(res, 408, {
            ok: false,
            error: err.message,
            stdout: err.stdout,
            stderr: err.stderr,
            timedOut: true,
          });
        }
        writeJson(res, err.statusCode || (err.name === 'SyntaxError' ? 400 : 500), {
          ok: false,
          error: err.message,
        });
      }
    }
  }), 'dsh-remote-workspace: /exec');
}
