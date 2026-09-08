import { SshService } from './ssh-service.js';
import { RemoteFsService } from './remote-fs-service.js';
import { MirrorSyncService } from './mirror-sync-service.js';
import { TunnelService } from './tunnel-service.js';
import { registerRemoteTools } from './tools.js';
import { registerApiRoutes } from './routes.js';

export const name = '@goodandready/dsh-remote-workspace';

export function apply(ctx, config) {
  // In-memory / persistent profile store
  const store = {
    profiles: config.profiles || [],
    activeId: config.activeProfileId || null,
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

  // Register Cordis Services
  ctx.provide('remoteSsh');
  ctx.provide('remoteFs');
  ctx.provide('remoteSync');
  ctx.provide('remoteTunnel');

  ctx.remoteSsh = sshService;
  ctx.remoteFs = remoteFs;
  ctx.remoteSync = mirrorSync;
  ctx.remoteTunnel = tunnelService;

  // Register Model Tools
  registerRemoteTools(ctx, sshService, remoteFs, mirrorSync, tunnelService, () => store.getActiveProfile());

  // Register API Routes
  registerApiRoutes(ctx, sshService, remoteFs, mirrorSync, tunnelService, store);

  // Cleanup on unload
  ctx.on('dispose', () => {
    tunnelService.stopAll();
    sshService.disconnectAll();
  });
}
