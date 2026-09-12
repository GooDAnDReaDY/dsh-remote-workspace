import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * VaultService manages credentials (password, privateKey, passphrase)
 * stored in an isolated, secure .env file instead of DSH profiles JSON.
 */
export class VaultService {
  constructor(customPath = null) {
    if (customPath) {
      this.envPath = customPath;
    } else {
      const homeDir = os.homedir();
      const secretsDir = path.join(homeDir, '.dsh', 'secrets');
      try {
        if (!fs.existsSync(secretsDir)) {
          fs.mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
        }
      } catch (_) {}
      this.envPath = path.join(secretsDir, 'dsh-remote-workspace.env');
    }
    this.ensureEnvFile();
  }

  ensureEnvFile() {
    try {
      if (!fs.existsSync(this.envPath)) {
        fs.writeFileSync(this.envPath, '# DSH Remote Workspace Encrypted Secrets Vault\n', { mode: 0o600, encoding: 'utf8' });
      } else {
        // Ensure file permissions are restricted to owner only
        try { fs.chmodSync(this.envPath, 0o600); } catch (_) {}
      }
    } catch (_) {}
  }

  /**
   * Parse .env file into key-value map
   */
  readAll() {
    this.ensureEnvFile();
    try {
      const content = fs.readFileSync(this.envPath, 'utf8');
      const lines = content.split('\n');
      const store = {};
      let currentKey = null;
      let currentValue = '';
      let isMultiline = false;

      for (const line of lines) {
        if (!isMultiline) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = line.indexOf('=');
          if (eqIdx === -1) continue;
          const key = line.slice(0, eqIdx).trim();
          let val = line.slice(eqIdx + 1);

          if (val.startsWith('"') && !val.endsWith('"')) {
            isMultiline = true;
            currentKey = key;
            currentValue = val.slice(1) + '\n';
          } else if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
            store[key] = val.slice(1, -1).replace(/\\n/g, '\n').replace(/\\r/g, '\r');
          } else {
            store[key] = val;
          }
        } else {
          if (line.endsWith('"')) {
            currentValue += line.slice(0, -1);
            store[currentKey] = currentValue.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
            isMultiline = false;
            currentKey = null;
            currentValue = '';
          } else {
            currentValue += line + '\n';
          }
        }
      }
      return store;
    } catch (err) {
      return {};
    }
  }

  writeAll(store) {
    this.ensureEnvFile();
    const lines = ['# DSH Remote Workspace Secrets Vault - Auto Generated', ''];
    for (const [key, val] of Object.entries(store)) {
      if (val === undefined || val === null || val === '') continue;
      const strVal = String(val);
      if (strVal.includes('\n') || strVal.includes('"') || strVal.includes('=')) {
        const escaped = strVal.replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n');
        lines.push(`${key}="${escaped}"`);
      } else {
        lines.push(`${key}=${strVal}`);
      }
    }
    lines.push('');
    fs.writeFileSync(this.envPath, lines.join('\n'), { mode: 0o600, encoding: 'utf8' });
  }

  keyPrefix(profileId) {
    const cleanId = profileId.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
    return `DRW_${cleanId}`;
  }

  getProfileSecrets(profileId) {
    if (!profileId) return {};
    const store = this.readAll();
    const prefix = this.keyPrefix(profileId);
    return {
      password: store[`${prefix}_PASSWORD`] || '',
      privateKey: store[`${prefix}_PRIVATE_KEY`] || '',
      passphrase: store[`${prefix}_PASSPHRASE`] || ''
    };
  }

  setProfileSecrets(profileId, secrets = {}) {
    if (!profileId) return;
    const store = this.readAll();
    const prefix = this.keyPrefix(profileId);

    if (secrets.password !== undefined) {
      if (secrets.password) store[`${prefix}_PASSWORD`] = secrets.password;
      else delete store[`${prefix}_PASSWORD`];
    }
    if (secrets.privateKey !== undefined) {
      if (secrets.privateKey) store[`${prefix}_PRIVATE_KEY`] = secrets.privateKey;
      else delete store[`${prefix}_PRIVATE_KEY`];
    }
    if (secrets.passphrase !== undefined) {
      if (secrets.passphrase) store[`${prefix}_PASSPHRASE`] = secrets.passphrase;
      else delete store[`${prefix}_PASSPHRASE`];
    }

    this.writeAll(store);
  }

  deleteProfileSecrets(profileId) {
    if (!profileId) return;
    const store = this.readAll();
    const prefix = this.keyPrefix(profileId);
    delete store[`${prefix}_PASSWORD`];
    delete store[`${prefix}_PRIVATE_KEY`];
    delete store[`${prefix}_PASSPHRASE`];
    this.writeAll(store);
  }

  /**
   * Enrich profile with secrets from .env vault before connecting
   */
  hydrateProfile(profile) {
    if (!profile || !profile.id) return profile;
    const secrets = this.getProfileSecrets(profile.id);
    return {
      ...profile,
      password: secrets.password || profile.password || '',
      privateKey: secrets.privateKey || profile.privateKey || '',
      passphrase: secrets.passphrase || profile.passphrase || ''
    };
  }

  /**
   * Strip secrets for public config/UI serialization
   */
  sanitizeProfile(profile) {
    if (!profile) return profile;
    const secrets = this.getProfileSecrets(profile.id);
    const hasPassword = Boolean(secrets.password || profile.password);
    const hasPrivateKey = Boolean(secrets.privateKey || profile.privateKey);
    const hasPassphrase = Boolean(secrets.passphrase || profile.passphrase);

    return {
      ...profile,
      password: hasPassword ? '••••••••' : '',
      privateKey: hasPrivateKey ? '••••••••' : '',
      passphrase: hasPassphrase ? '••••••••' : '',
      hasStoredPassword: hasPassword,
      hasStoredPrivateKey: hasPrivateKey,
      hasStoredPassphrase: hasPassphrase
    };
  }
}
