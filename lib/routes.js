import { registerPluginUpdater } from './updater-service.js';
import { isTrustedSettingsRequest } from './routes/helpers.js';
import { registerProfileRoutes } from './routes/profiles.js';
import { registerFileRoutes } from './routes/files.js';
import { registerEnvRoutes } from './routes/env.js';
import { registerTerminalRoutes } from './routes/terminal.js';
import { registerTunnelRoutes } from './routes/tunnels.js';
import { registerDockerRoutes } from './routes/docker.js';
import { registerSyncRoutes } from './routes/sync.js';

export { isTrustedSettingsRequest } from './routes/helpers.js';

export function registerApiRoutes(
  ctx,
  sshService,
  remoteFs,
  mirrorSync,
  tunnelService,
  store,
  dockerService,
  healthService,
  watcherService,
  diagnoseService,
  envService,
  tarSyncService,
  alertService
) {
  ctx.inject(['webServer'], (sctx) => {
    const webServer = sctx.get ? (sctx.get('webServer') ?? sctx.webServer) : sctx.webServer;
    if (!webServer || typeof webServer.register !== 'function') return;

    // Plugin updater registration
    sctx.effect(() => registerPluginUpdater(sctx, {
      packageName: '@goodandready/dsh-remote-workspace',
      endpoint: '/dsh-remote-workspace/update',
      manifestUrl: new URL('../package.json', import.meta.url)
    }), 'dsh-remote-workspace: updater');

    sctx.effect(() => registerPluginUpdater(sctx, {
      packageName: '@goodandready/dsh-remote-workspace',
      endpoint: '/api/dsh-remote-workspace/update',
      manifestUrl: new URL('../package.json', import.meta.url)
    }), 'dsh-remote-workspace: api-updater');

    registerProfileRoutes(sctx, webServer, { store, sshService, alertService, tunnelService });
    registerFileRoutes(sctx, webServer, { remoteFs, store, sshService });
    registerEnvRoutes(sctx, webServer, { envService, diagnoseService, sshService, store });
    registerTerminalRoutes(sctx, webServer, { sshService, store });
    registerTunnelRoutes(sctx, webServer, { tunnelService, store });
    registerDockerRoutes(sctx, webServer, { dockerService, healthService, store });
    registerSyncRoutes(sctx, webServer, { mirrorSync, tarSyncService, watcherService, store });
  });
}
