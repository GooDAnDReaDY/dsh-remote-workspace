import { registerPluginUpdater } from './updater-service.js';
import { isTrustedSettingsRequest } from './routes/helpers.js';
import { registerProfileRoutes } from './routes/profiles.js';
import { registerFileRoutes } from './routes/files.js';
import { registerEnvRoutes } from './routes/env.js';
import { registerTerminalRoutes } from './routes/terminal.js';
import { registerTunnelRoutes } from './routes/tunnels.js';
import { registerDockerRoutes } from './routes/docker.js';
import { registerSyncRoutes } from './routes/sync.js';
import { registerExecRoutes } from './routes/exec.js';
import { registerSearchRoutes } from './routes/search.js';
import { registerGitRoutes } from './routes/git.js';
import { registerBootstrapRoutes } from './routes/bootstrap.js';

export { isTrustedSettingsRequest, authorizeRequest, readBody, MAX_BODY_BYTES, timingSafeCompare } from './routes/helpers.js';

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
  alertService,
  gitService = null,
  bootstrapService = null
) {
  ctx.inject(['webServer'], (sctx) => {
    const webServer = sctx.get ? (sctx.get('webServer') ?? sctx.webServer) : sctx.webServer;
    if (!webServer || typeof webServer.register !== 'function') {
      const errMsg = 'webServer service is missing or lacks register() method';
      ctx.logger?.warn?.(`[dsh-remote-workspace] ${errMsg}`);
      if (store?.setRouteStatus) {
        store.setRouteStatus({ registered: false, pending: false, error: errMsg });
      }
      if (alertService?.addAlert) {
        alertService.addAlert({
          id: 'route-registration-failure',
          level: 'warn',
          title: 'Web routes registration failed',
          message: errMsg,
          timestamp: Date.now()
        });
      }
      return;
    }

    try {
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
      registerEnvRoutes(sctx, webServer, { envService, diagnoseService, sshService, store, remoteFs });
      registerTerminalRoutes(sctx, webServer, { sshService, store });
      registerTunnelRoutes(sctx, webServer, { tunnelService, store });
      registerDockerRoutes(sctx, webServer, { dockerService, healthService, store });
      registerSyncRoutes(sctx, webServer, { mirrorSync, tarSyncService, watcherService, store });
      registerExecRoutes(sctx, webServer, { store, sshService });
      registerSearchRoutes(sctx, webServer, { store, sshService });
      if (gitService) {
        registerGitRoutes(sctx, webServer, { gitService, store });
      }
      if (bootstrapService) {
        registerBootstrapRoutes(sctx, webServer, { bootstrapService, store });
      }

      if (store?.setRouteStatus) {
        store.setRouteStatus({ registered: true, pending: false, error: null });
      }
      ctx.logger?.info?.('[dsh-remote-workspace] Web routes registered successfully');
    } catch (err) {
      const errMsg = `Web routes registration error: ${err.message}`;
      ctx.logger?.error?.(`[dsh-remote-workspace] ${errMsg}`);
      if (store?.setRouteStatus) {
        store.setRouteStatus({ registered: false, pending: false, error: errMsg });
      }
      if (alertService?.addAlert) {
        alertService.addAlert({
          id: 'route-registration-error',
          level: 'error',
          title: 'Web routes registration error',
          message: errMsg,
          timestamp: Date.now()
        });
      }
    }

    sctx.effect(() => () => {
      if (store?.setRouteStatus) {
        store.setRouteStatus({ registered: false, pending: true, error: null });
      }
    });
  });
}
