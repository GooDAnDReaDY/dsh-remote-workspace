import z from '@deepseek-ai/schemastery';
import { VaultService } from './vault-service.js';
import { SshService } from './ssh-service.js';
import { RemoteFsService } from './remote-fs-service.js';
import { MirrorSyncService } from './mirror-sync-service.js';
import { TunnelService } from './tunnel-service.js';
import { DockerService } from './docker-service.js';
import { HealthService } from './health-service.js';
import { WatcherService } from './watcher-service.js';
import { TarSyncService } from './tar-sync-service.js';
import { DiagnoseService } from './diagnose-service.js';
import { EnvService } from './env-service.js';
import { AlertService } from './alert-service.js';
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
    localMirrorPath: z.string().default(''),
    jumpHostId: z.string().default('')
  })).default([]).description('List of configured remote machines and workspaces.'),
  activeProfileId: z.string().default('').description('ID of active remote profile.'),
  autoSyncActive: z.boolean().default(false).description('Whether Live Auto-Sync watcher is enabled.'),
  alertMonitoringActive: z.boolean().default(false).description('Whether background anomaly alerts are monitored.')
});

export function apply(ctx, config = {}) {
  const cfg = config || {};
  let settingsApi = null;
  let currentConfig = {
    profiles: Array.isArray(cfg.profiles) ? cfg.profiles : [],
    activeProfileId: cfg.activeProfileId || null,
    autoSyncActive: Boolean(cfg.autoSyncActive),
    alertMonitoringActive: Boolean(cfg.alertMonitoringActive)
  };

  const vaultService = new VaultService();
  const sshService = new SshService(ctx, vaultService);
  const remoteFs = new RemoteFsService(sshService);
  const mirrorSync = new MirrorSyncService(remoteFs, sshService);
  const tunnelService = new TunnelService(sshService);
  const dockerService = new DockerService(sshService);
  const healthService = new HealthService(sshService);
  const watcherService = new WatcherService();
  const tarSyncService = new TarSyncService(sshService);
  const diagnoseService = new DiagnoseService(sshService);
  const envService = new EnvService(remoteFs);
  const alertService = new AlertService(ctx, healthService, dockerService);

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

  const persistConfig = async (actionLabel) => {
    if (settingsApi?.replace) {
      try {
        await settingsApi.replace(Config(currentConfig));
      } catch (err) {
        if (ctx.logger?.warn) {
          ctx.logger.warn(`[dsh-remote-workspace] Failed to persist config after ${actionLabel}: ${err.message}`);
        }
        throw new Error(`Failed to save configuration: ${err.message}`);
      }
    }
  };

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
    isAutoSyncEnabled() { return Boolean(currentConfig.autoSyncActive); },
    async setAutoSyncEnabled(enabled) {
      currentConfig.autoSyncActive = Boolean(enabled);
      const active = store.getActiveProfile();
      if (active) {
        if (enabled) watcherService.start(active, mirrorSync);
        else watcherService.stop(active.id);
      }
      await persistConfig('update');
    },
    async saveProfile(rawP) {
      const list = [...(currentConfig.profiles || [])];
      const p = { ...rawP };

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
      await persistConfig('update');
    },
    async deleteProfile(id) {
      watcherService.stop(id);
      currentConfig.profiles = (currentConfig.profiles || []).filter((p) => p.id !== id);
      if (currentConfig.activeProfileId === id) {
        currentConfig.activeProfileId = currentConfig.profiles[0]?.id || null;
      }
      vaultService.deleteProfileSecrets(id);
      sshService.disconnect(id);
      await persistConfig('update');
    },
    async setActiveId(id) {
      currentConfig.activeProfileId = id;
      if (currentConfig.autoSyncActive) {
        watcherService.stopAll();
        const active = store.getActiveProfile();
        if (active) watcherService.start(active, mirrorSync);
      }
      await persistConfig('update');
    }
  };

  sshService.setJumpProfileResolver((jumpId) => store.getProfile(jumpId));

  // If autoSync was enabled on restart, resume watcher for active profile
  if (currentConfig.autoSyncActive && currentConfig.activeProfileId) {
    const active = store.getActiveProfile();
    if (active) watcherService.start(active, mirrorSync);
  }

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
      if (snap.autoSyncActive !== undefined) currentConfig.autoSyncActive = snap.autoSyncActive;
      if (snap.alertMonitoringActive !== undefined) currentConfig.alertMonitoringActive = snap.alertMonitoringActive;
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
  ctx.provide('remoteDocker');
  ctx.provide('remoteHealth');
  ctx.provide('remoteWatcher');
  ctx.provide('remoteTarSync');
  ctx.provide('remoteDiagnose');
  ctx.provide('remoteEnv');
  ctx.provide('remoteAlert');

  ctx.remoteSsh = sshService;
  ctx.remoteFs = remoteFs;
  ctx.remoteSync = mirrorSync;
  ctx.remoteTunnel = tunnelService;
  ctx.remoteVault = vaultService;
  ctx.remoteDocker = dockerService;
  ctx.remoteHealth = healthService;
  ctx.remoteWatcher = watcherService;
  ctx.remoteTarSync = tarSyncService;
  ctx.remoteDiagnose = diagnoseService;
  ctx.remoteEnv = envService;
  ctx.remoteAlert = alertService;

  // Tools registration
  registerRemoteTools(
    ctx,
    sshService,
    remoteFs,
    mirrorSync,
    tunnelService,
    () => store.getActiveProfile(),
    (id) => store.getProfile(id),
    dockerService,
    diagnoseService,
    envService,
    tarSyncService
  );

  // API Routes
  registerApiRoutes(
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
  );

  // Cleanup on unload
  ctx.on('dispose', () => {
    alertService.stop();
    watcherService.stopAll();
    tunnelService.stopAll();
    sshService.disconnectAll();
  });
}
