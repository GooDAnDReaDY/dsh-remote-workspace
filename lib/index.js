import z from '@deepseek-ai/schemastery';
import { VaultService } from './vault-service.js';
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
    id: z.string().default(''),
    name: z.string().default(''),
    host: z.string().default(''),
    port: z.number().default(22),
    username: z.string().default('root'),
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

  const vaultService = new VaultService();
  const sshService = new SshService(ctx, vaultService);
  const remoteFs = new RemoteFsService(sshService);
  const mirrorSync = new MirrorSyncService(remoteFs, sshService);
  const tunnelService = new TunnelService(sshService);

  // Migrate any existing plain passwords into vault upon start
  for (const p of currentConfig.profiles) {
    if (p.id && (p.password || p.privateKey || p.passphrase)) {
      if (p.password && p.password !== '••••••••') {
        vaultService.setProfileSecrets(p.id, { password: p.password });
        p.password = '';
      }
      if (p.privateKey && p.privateKey !== '••••••••') {
        vaultService.setProfileSecrets(p.id, { privateKey: p.privateKey });
        p.privateKey = '';
      }
      if (p.passphrase && p.passphrase !== '••••••••') {
        vaultService.setProfileSecrets(p.id, { passphrase: p.passphrase });
        p.passphrase = '';
      }
    }
  }

  const store = {
    vault: vaultService,
    getRawProfiles() { return currentConfig.profiles || []; },
    getProfiles() {
      return (currentConfig.profiles || []).map((p) => vaultService.sanitizeProfile(p));
    },
    getProfile(id) {
      const p = (currentConfig.profiles || []).find((x) => x.id === id);
      return p ? vaultService.hydrateProfile(p) : undefined;
    },
    getActiveId() { return currentConfig.activeProfileId; },
    getActiveProfile() {
      const p = (currentConfig.profiles || []).find((x) => x.id === currentConfig.activeProfileId);
      return p ? vaultService.hydrateProfile(p) : undefined;
    },
    async saveProfile(rawP) {
      const list = [...(currentConfig.profiles || [])];
      const p = { ...rawP };

      // Save secret credentials into isolated .env file if provided
      const secretsToUpdate = {};
      if (p.password !== undefined && p.password !== '••••••••') {
        secretsToUpdate.password = p.password;
      }
      if (p.privateKey !== undefined && p.privateKey !== '••••••••') {
        secretsToUpdate.privateKey = p.privateKey;
      }
      if (p.passphrase !== undefined && p.passphrase !== '••••••••') {
        secretsToUpdate.passphrase = p.passphrase;
      }
      if (Object.keys(secretsToUpdate).length > 0) {
        vaultService.setProfileSecrets(p.id, secretsToUpdate);
      }

      // Do NOT keep raw secrets in public config
      p.password = '';
      p.privateKey = '';
      p.passphrase = '';

      const idx = list.findIndex((x) => x.id === p.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...p };
      else list.push(p);

      currentConfig.profiles = list;
      if (!currentConfig.activeProfileId && list.length === 1) {
        currentConfig.activeProfileId = p.id;
      }
      sshService.invalidate(p.id);
      if (settingsApi?.replace) {
        try { await settingsApi.replace(Config(currentConfig)); } catch (_) {}
      }
    },
    async deleteProfile(id) {
      currentConfig.profiles = (currentConfig.profiles || []).filter((p) => p.id !== id);
      if (currentConfig.activeProfileId === id) {
        currentConfig.activeProfileId = currentConfig.profiles[0]?.id || null;
      }
      vaultService.deleteProfileSecrets(id);
      sshService.disconnect(id);
      if (settingsApi?.replace) {
        try { await settingsApi.replace(Config(currentConfig)); } catch (_) {}
      }
    },
    async setActiveId(id) {
      currentConfig.activeProfileId = id;
      if (settingsApi?.replace) {
        try { await settingsApi.replace(Config(currentConfig)); } catch (_) {}
      }
    }
  };

  // Register settings namespace if settings service is available
  ctx.inject(['settings'], (sctx) => {
    const settingsService = sctx.get ? (sctx.get('settings') ?? sctx.settings) : sctx.settings;
    if (!settingsService || typeof settingsService.register !== 'function') return;

    const scope = settingsService.register(NS, Config, { base: cfg });
    settingsApi = scope;
    const snap = scope.get ? scope.get() : null;
    if (snap) {
      if (Array.isArray(snap.profiles)) currentConfig.profiles = snap.profiles;
      if (snap.activeProfileId !== undefined) currentConfig.activeProfileId = snap.activeProfileId;
    }
    sctx.effect(() => () => {
      settingsApi = null;
    });
  });

  ctx.provide('remoteSsh');
  ctx.provide('remoteFs');
  ctx.provide('remoteSync');
  ctx.provide('remoteTunnel');
  ctx.provide('remoteVault');

  ctx.remoteSsh = sshService;
  ctx.remoteFs = remoteFs;
  ctx.remoteSync = mirrorSync;
  ctx.remoteTunnel = tunnelService;
  ctx.remoteVault = vaultService;

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
