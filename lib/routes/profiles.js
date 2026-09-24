import { writeJson, readBody, isTrustedSettingsRequest } from './helpers.js';
import { SshConfigParser } from '../ssh-config-parser.js';

function maskProfile(p) {
  if (!p || typeof p !== 'object') return p;
  const masked = { ...p };
  if (masked.password) masked.password = '••••••••';
  if (masked.privateKey) masked.privateKey = '••••••••';
  if (masked.passphrase) masked.passphrase = '••••••••';
  return masked;
}

export function registerProfileRoutes(sctx, webServer, { store, sshService, alertService, tunnelService }) {
  // 1. GET /dsh-remote-workspace/state
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/state',
    handler: async (req, res) => {
      if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET only' });
      if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
      try {
        const profiles = store.getProfiles();
        const activeId = store.getActiveId() || (profiles[0]?.id || '');
        const tunnels = tunnelService.listActiveTunnels();
        const autoSync = store.isAutoSyncEnabled ? store.isAutoSyncEnabled() : false;
        const alerts = alertService ? alertService.getAlerts() : [];
        const sanitized = profiles.map((p) => (store.vault ? store.vault.sanitizeProfile(p) : maskProfile(p)));
        writeJson(res, 200, { ok: true, activeId, profiles: sanitized, tunnels, autoSync, alerts });
      } catch (err) {
        writeJson(res, 500, { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /state');

  // 2. POST /dsh-remote-workspace/profiles/save
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/profiles/save',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
      try {
        const profile = await readBody(req);
        if (!profile.id || !profile.host) {
          return writeJson(res, 400, { ok: false, error: 'ID and Host are required' });
        }
        sshService.invalidate(profile.id);
        await store.saveProfile(profile);
        const sanitized = store.vault ? store.vault.sanitizeProfile(profile) : maskProfile(profile);
        writeJson(res, 200, { ok: true, profile: sanitized });
      } catch (err) {
        writeJson(res, 500, { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /profiles/save');

  // 3. POST /dsh-remote-workspace/profiles/delete
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/profiles/delete',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
      try {
        const { id } = await readBody(req);
        if (!id) return writeJson(res, 400, { ok: false, error: 'ID is required' });
        sshService.disconnect(id);
        await store.deleteProfile(id);
        writeJson(res, 200, { ok: true });
      } catch (err) {
        writeJson(res, 500, { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /profiles/delete');

  // 4. POST /dsh-remote-workspace/profiles/active
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/profiles/active',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
      try {
        const { id } = await readBody(req);
        if (!id) return writeJson(res, 400, { ok: false, error: 'ID is required' });
        await store.setActiveId(id);
        writeJson(res, 200, { ok: true, activeId: id });
      } catch (err) {
        writeJson(res, 500, { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /profiles/active');

  // 5. POST /dsh-remote-workspace/profiles/import-ssh-config
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/profiles/import-ssh-config',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
      try {
        const { content } = await readBody(req);
        if (!content || typeof content !== 'string') {
          return writeJson(res, 400, { ok: false, error: 'SSH config content is required' });
        }
        const importedProfiles = SshConfigParser.parse(content);
        for (const p of importedProfiles) {
          await store.saveProfile(p);
        }
        writeJson(res, 200, { ok: true, count: importedProfiles.length, profiles: importedProfiles });
      } catch (err) {
        writeJson(res, 500, { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /profiles/import-ssh-config');

  // 6. POST /dsh-remote-workspace/test
  sctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-remote-workspace/test',
    handler: async (req, res) => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST only' });
      if (!isTrustedSettingsRequest(req)) return writeJson(res, 403, { ok: false, error: 'Forbidden' });
      try {
        const profile = await readBody(req);
        if (!profile.host) return writeJson(res, 400, { ok: false, error: 'Host is required' });

        const existing = store.getProfile(profile.id);
        const effectiveProfile = {
          ...profile,
          password: profile.password && profile.password !== '••••••••'
            ? profile.password
            : (existing?.password || ''),
          privateKey: profile.privateKey && profile.privateKey !== '••••••••'
            ? profile.privateKey
            : (existing?.privateKey || ''),
          passphrase: profile.passphrase && profile.passphrase !== '••••••••'
            ? profile.passphrase
            : (existing?.passphrase || '')
        };

        const result = await sshService.testConnection(effectiveProfile);
        const latencyMs = result.latency !== undefined ? result.latency : (result.latencyMs ?? 0);
        const remoteOs = result.os !== undefined ? result.os : (result.remoteOs ?? 'Linux/Unix');
        writeJson(res, 200, { ok: true, latency: latencyMs, latencyMs, os: remoteOs, remoteOs });
      } catch (err) {
        writeJson(res, 200, { ok: false, error: err.message });
      }
    }
  }), 'dsh-remote-workspace: /test');
}
