import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

/**
 * Resolve DSH home directory, respecting custom DSH_HOME environment variable.
 */
export function resolveDshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
}

/**
 * VaultService manages credentials (password, privateKey, passphrase)
 * stored in an isolated, secure .env file with owner-only (0600) permissions
 * and encrypted on-disk using AES-256-GCM (with dsh-secret-vault integration if present).
 */
export class VaultService {
  constructor(customPath = null, options = {}) {
    this.permissionError = null;
    this.options = typeof options === 'object' && options !== null ? options : {};
    this.cordisVault = this.options.secretVault || null;
    this._masterKey = null;

    if (this.options.cordisCtx && typeof this.options.cordisCtx.inject === 'function') {
      try {
        this.options.cordisCtx.inject(['secretVault'], (vctx) => {
          try {
            const sv = vctx.get ? (vctx.get('secretVault') ?? vctx.secretVault) : vctx.secretVault;
            if (sv) this.cordisVault = sv;
          } catch (_injectErr) {
            this.cordisVault = null;
          }
        });
      } catch (_ctxErr) {
        this.cordisVault = null;
      }
    }

    if (customPath) {
      this.envPath = customPath;
    } else {
      const dshHome = resolveDshHome();
      const secretsDir = path.join(dshHome, 'secrets');
      try {
        if (!fs.existsSync(secretsDir)) {
          fs.mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
        }
        if (fs.existsSync(secretsDir)) {
          try {
            fs.chmodSync(secretsDir, 0o700);
          } catch (chmodErr) {
            this.permissionError = `Failed to set 0700 permissions on secrets dir: ${chmodErr.message}`;
          }
        }
      } catch (mkdirErr) {
        this.permissionError = `Failed to initialize secrets directory: ${mkdirErr.message}`;
      }
      this.envPath = path.join(secretsDir, 'dsh-remote-workspace.env');
    }
    this.ensureEnvFile();
  }

  ensureMasterKey() {
    if (this._masterKey) return this._masterKey;
    if (this.options.masterKey) {
      this._masterKey = Buffer.isBuffer(this.options.masterKey)
        ? this.options.masterKey
        : Buffer.from(this.options.masterKey, 'hex');
      return this._masterKey;
    }
    const keyPath = this.options.keyPath || `${this.envPath}.key`;
    try {
      if (fs.existsSync(keyPath)) {
        const buf = fs.readFileSync(keyPath);
        if (buf.length === 32) {
          this._masterKey = buf;
          return this._masterKey;
        }
      }
      const newKey = crypto.randomBytes(32);
      try {
        fs.writeFileSync(keyPath, newKey, { mode: 0o600 });
        this._masterKey = newKey;
        return this._masterKey;
      } catch (_writeErr) {
        // Fallback to system/machine entropy
        const entropy = `${os.hostname()}:${os.userInfo().username}:${process.arch}:${os.platform()}`;
        this._masterKey = crypto.createHash('sha256').update(entropy).digest();
        return this._masterKey;
      }
    } catch (_err) {
      const entropy = `${os.hostname()}:${os.userInfo().username}:${process.arch}:${os.platform()}`;
      this._masterKey = crypto.createHash('sha256').update(entropy).digest();
      return this._masterKey;
    }
  }

  setSecretVault(sv) {
    this.cordisVault = sv;
  }

  encrypt(text) {
    if (text === undefined || text === null || text === '') return '';
    const str = String(text);
    if (str.startsWith('enc:v1:')) return str;
    if (this.cordisVault && typeof this.cordisVault.encrypt === 'function') {
      return this.cordisVault.encrypt(str);
    }
    const key = this.ensureMasterKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const packed = Buffer.concat([iv, tag, encrypted]);
    return `enc:v1:${packed.toString('base64')}`;
  }

  decrypt(stored) {
    if (stored === undefined || stored === null || stored === '') return '';
    const str = String(stored);
    if (this.cordisVault && typeof this.cordisVault.decrypt === 'function') {
      try {
        return this.cordisVault.decrypt(str);
      } catch (_e) {
        // fallback to internal
      }
    }
    if (!str.startsWith('enc:v1:')) {
      return str; // Backward compatibility with unencrypted values
    }
    try {
      const b64 = str.slice('enc:v1:'.length);
      const packed = Buffer.from(b64, 'base64');
      if (packed.length < 28) return str;
      const iv = packed.subarray(0, 12);
      const tag = packed.subarray(12, 28);
      const ciphertext = packed.subarray(28);
      const key = this.ensureMasterKey();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return decipher.update(ciphertext, null, 'utf8') + decipher.final('utf8');
    } catch (_err) {
      return str;
    }
  }

  ensureEnvFile() {
    try {
      if (!fs.existsSync(this.envPath)) {
        fs.writeFileSync(this.envPath, '# DSH Remote Workspace Secrets Vault (Owner-Only Permissions 0600)\n', { mode: 0o600, encoding: 'utf8' });
      } else {
        // Ensure file permissions are restricted to owner only
        try {
          fs.chmodSync(this.envPath, 0o600);
        } catch (chmodErr) {
          this.permissionError = `Failed to restrict permissions on ${this.envPath}: ${chmodErr.message}`;
        }
      }
    } catch (err) {
      this.permissionError = `Failed to ensure vault file: ${err.message}`;
    }
  }

  getPermissionStatus() {
    return {
      secure: !this.permissionError,
      protection: 'owner-only-permissions',
      encrypted: true,
      algorithm: 'aes-256-gcm',
      error: this.permissionError,
      path: this.envPath
    };
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
            store[key] = val.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\r/g, '\r');
          } else {
            store[key] = val;
          }
        } else {
          if (line.endsWith('"')) {
            currentValue += line.slice(0, -1);
            store[currentKey] = currentValue.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\r/g, '\r');
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
    const lines = ['# DSH Remote Workspace Secrets Vault (Owner-Only Permissions 0600)', ''];
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
      password: this.decrypt(store[`${prefix}_PASSWORD`] || ''),
      privateKey: this.decrypt(store[`${prefix}_PRIVATE_KEY`] || ''),
      passphrase: this.decrypt(store[`${prefix}_PASSPHRASE`] || '')
    };
  }

  setProfileSecrets(profileId, secrets = {}) {
    if (!profileId) return;
    const store = this.readAll();
    const prefix = this.keyPrefix(profileId);

    if (secrets.password !== undefined) {
      if (secrets.password) store[`${prefix}_PASSWORD`] = this.encrypt(secrets.password);
      else delete store[`${prefix}_PASSWORD`];
    }
    if (secrets.privateKey !== undefined) {
      if (secrets.privateKey) store[`${prefix}_PRIVATE_KEY`] = this.encrypt(secrets.privateKey);
      else delete store[`${prefix}_PRIVATE_KEY`];
    }
    if (secrets.passphrase !== undefined) {
      if (secrets.passphrase) store[`${prefix}_PASSPHRASE`] = this.encrypt(secrets.passphrase);
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
