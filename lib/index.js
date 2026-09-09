import { SshService } from './ssh-service.js';
import { RemoteFsService } from './remote-fs-service.js';
import { MirrorSyncService } from './mirror-sync-service.js';
import { TunnelService } from './tunnel-service.js';
import { registerRemoteTools } from './tools.js';
import { registerApiRoutes } from './routes.js';

export const name = '@goodandready/dsh-remote-workspace';

// Declare required and optional Cordis services
export const inject = {
  required: [],
  optional: ['tools', 'webServer', 'settings', 'router']
};

export function apply(ctx, config = {}) {
  const cfg = config || {};
  // In-memory / persistent profile store
  const store = {
    profiles: cfg.profiles || [],
    activeId: cfg.activeProfileId || null,
    getProfiles() { return this.profiles; },
    getProfile(id) { return this.profiles.find((p) => p.id === id); },
    getActiveId() { return this.activeId; },
    getActiveProfile() { return this.profiles.find((p) => p.id === this.activeId); },
    saveProfile(p) {
      const idx = this.profiles.findIndex((x) => x.id === p.id);
      if (idx >= 0) this.profiles[idx] = p;
      else this.profiles.push(p);
    }
  };

  const sshService = new SshService(ctx);
  const remoteFs = new RemoteFsService(sshService);
  const mirrorSync = new MirrorSyncService(remoteFs, sshService);
  const tunnelService = new TunnelService(sshService);

  // Register Cordis Services provided by this plugin
  ctx.provide('remoteSsh');
  ctx.provide('remoteFs');
  ctx.provide('remoteSync');
  ctx.provide('remoteTunnel');

  ctx.remoteSsh = sshService;
  ctx.remoteFs = remoteFs;
  ctx.remoteSync = mirrorSync;
  ctx.remoteTunnel = tunnelService;

  // Conditionally register Model Tools when 'tools' service becomes available
  ctx.inject(['tools'], (tctx) => {
    registerRemoteTools(tctx, sshService, remoteFs, mirrorSync, tunnelService, () => store.getActiveProfile());
  });

  // Conditionally register API Routes when 'router' or 'webServer' service becomes available
  if (ctx.router) {
    registerApiRoutes(ctx, sshService, remoteFs, mirrorSync, tunnelService, store);
  } else {
    ctx.inject(['router'], (rctx) => {
      registerApiRoutes(rctx, sshService, remoteFs, mirrorSync, tunnelService, store);
    });
  }

  // Cleanup on unload
  ctx.on('dispose', () => {
    tunnelService.stopAll();
    sshService.disconnectAll();
  });
}
