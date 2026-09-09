import z from '@deepseek-ai/schemastery';
import { SshService } from './ssh-service.js';
import { RemoteFsService } from './remote-fs-service.js';
import { MirrorSyncService } from './mirror-sync-service.js';
import { TunnelService } from './tunnel-service.js';
import { registerRemoteTools } from './tools.js';
import { registerApiRoutes } from './routes.js';

export const name = '@goodandready/dsh-remote-workspace';

const NS = 'dsh-remote-workspace';

export const inject = ['tools'];

export const Config = z.object({
  profiles: z.array(z.object({
    id: z.string(),
    name: z.string(),
    host: z.string(),
    port: z.number().default(22),
    username: z.string(),
    authType: z.string().default('key'),
    privateKeyPath: z.string().default(''),
    privateKey: z.string().default(''),
    passphrase: z.string().default(''),
    password: z.string().default(''),
    remoteWorkspace: z.string().default(''),
    localMirrorPath: z.string().default('')
  })).default([]).description('List of configured remote machines and workspaces.'),
  activeProfileId: z.string().default('').description('ID of active remote profile.')
});

export function apply(ctx, config = {}) {
  const cfg = config || {};
  let settingsApi = null;
  let currentConfig = {
    profiles: Array.isArray(cfg.profiles) ? cfg.profiles : [],
    activeProfileId: cfg.activeProfileId || null
  };

  const store = {
    getProfiles() { return currentConfig.profiles || []; },
    getProfile(id) { return (currentConfig.profiles || []).find((p) => p.id === id); },
    getActiveId() { return currentConfig.activeProfileId; },
    getActiveProfile() { return (currentConfig.profiles || []).find((p) => p.id === currentConfig.activeProfileId); },
    async saveProfile(p) {
      const list = [...(currentConfig.profiles || [])];
      const idx = list.findIndex((x) => x.id === p.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...p };
      else list.push(p);
      currentConfig.profiles = list;
      if (!currentConfig.activeProfileId && list.length === 1) {
        currentConfig.activeProfileId = p.id;
      }
      if (settingsApi?.replace) {
        await settingsApi.replace(Config(currentConfig));
      }
    },
    async deleteProfile(id) {
      currentConfig.profiles = (currentConfig.profiles || []).filter((p) => p.id !== id);
      if (currentConfig.activeProfileId === id) {
        currentConfig.activeProfileId = currentConfig.profiles[0]?.id || null;
      }
      if (settingsApi?.replace) {
        await settingsApi.replace(Config(currentConfig));
      }
    },
    async setActiveId(id) {
      currentConfig.activeProfileId = id;
      if (settingsApi?.replace) {
        await settingsApi.replace(Config(currentConfig));
      }
    }
  };

  // Register settings namespace if settings service is available
  ctx.inject(['settings'], (sctx) => {
    const scope = sctx.settings.register(NS, Config, { base: cfg });
    settingsApi = scope;
    const snap = scope.get();
    if (snap) {
      if (Array.isArray(snap.profiles)) currentConfig.profiles = snap.profiles;
      if (snap.activeProfileId !== undefined) currentConfig.activeProfileId = snap.activeProfileId;
    }
    sctx.effect(() => () => {
      settingsApi = null;
    });
  });

  const sshService = new SshService(ctx);
  const remoteFs = new RemoteFsService(sshService);
  const mirrorSync = new MirrorSyncService(remoteFs, sshService);
  const tunnelService = new TunnelService(sshService);

  ctx.provide('remoteSsh');
  ctx.provide('remoteFs');
  ctx.provide('remoteSync');
  ctx.provide('remoteTunnel');

  ctx.remoteSsh = sshService;
  ctx.remoteFs = remoteFs;
  ctx.remoteSync = mirrorSync;
  ctx.remoteTunnel = tunnelService;

  // Tools registration
  registerRemoteTools(ctx, sshService, remoteFs, mirrorSync, tunnelService, () => store.getActiveProfile());

  // API Routes
  registerApiRoutes(ctx, sshService, remoteFs, mirrorSync, tunnelService, store);

  // Cleanup on unload
  ctx.on('dispose', () => {
    tunnelService.stopAll();
    sshService.disconnectAll();
  });
}
