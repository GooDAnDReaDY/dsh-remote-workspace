import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

/**
 * OpenSSH-style SHA256 fingerprint of a raw SSH host key blob (#158).
 */
export function computeHostKeyFingerprint(hostKey) {
  const buf = Buffer.isBuffer(hostKey) ? hostKey : Buffer.from(String(hostKey || ''), 'binary');
  if (!buf.length) return { fingerprint: '', algorithm: '' };
  const digest = crypto.createHash('sha256').update(buf).digest('base64').replace(/=+$/, '');
  // The SSH wire format starts with the key type name: uint32 length + ascii.
  let algorithm = '';
  if (buf.length > 4) {
    const nameLen = buf.readUInt32BE(0);
    if (nameLen > 0 && nameLen < 64 && 4 + nameLen <= buf.length) {
      algorithm = buf.slice(4, 4 + nameLen).toString('ascii');
    }
  }
  return { fingerprint: `SHA256:${digest}`, algorithm };
}

/**
 * Read base-64 (non-hashed) entries from an OpenSSH known_hosts file.
 * Hashed `|1|...` entries are skipped: the plugin cannot reverse them, and
 * pattern matching would silently fail open, which is worse than absent.
 */
export function parseKnownHosts(filePath) {
  const byHost = new Map();
  let raw = '';
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return byHost;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) continue;
    const [hostField, keyType, keyBody] = parts;
    if (hostField.startsWith('|1|')) continue; // hashed hostname: cannot match safely
    let keyBuf;
    try {
      keyBuf = Buffer.from(keyBody, 'base64');
    } catch {
      continue;
    }
    const { fingerprint } = computeHostKeyFingerprint(keyBuf);
    for (const host of hostField.split(',')) {
      if (!host || host.startsWith('@')) continue; // @revoked/@cert-authority markers
      byHost.set(host, { fingerprint, algorithm: keyType });
    }
  }
  return byHost;
}

/**
 * Errors carrying an actionable message and a stable code, so callers can
 * distinguish "unknown host key" (TOFU candidate) from "mismatch" (MITM
 * suspicion) and routes can surface them as-is.
 */
export class HostKeyError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

export class HostKeyUnknownError extends HostKeyError {
  constructor(message, details) {
    super(message, 'HOST_KEY_UNKNOWN', details);
  }
}

export class HostKeyMismatchError extends HostKeyError {
  constructor(message, details) {
    super(message, 'HOST_KEY_MISMATCH', details);
  }
}

const DEFAULT_STORE_FILE = path.join(os.homedir(), '.dsh-remote-workspace', 'known-hosts.json');
const DEFAULT_KNOWN_HOSTS = path.join(os.homedir(), '.ssh', 'known_hosts');

/**
 * TOFU (trust-on-first-use) host key store, optionally seeded from an OpenSSH
 * known_hosts file (#158). Keys are persisted as `host:port -> fingerprint`.
 */
export class HostKeyStore {
  constructor({ storeFile = DEFAULT_STORE_FILE, knownHostsFiles = [DEFAULT_KNOWN_HOSTS] } = {}) {
    this.storeFile = storeFile;
    this.knownHostsFiles = knownHostsFiles;
    this._entries = null;
  }

  load() {
    if (this._entries) return this._entries;
    this._entries = new Map();
    try {
      const raw = fs.readFileSync(this.storeFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(parsed)) {
          if (value && typeof value.fingerprint === 'string') {
            this._entries.set(key, value);
          }
        }
      }
    } catch {
      // first run or unreadable store: start empty
    }
    return this._entries;
  }

  key(host, port) {
    return `${host}:${port || 22}`;
  }

  lookup(host, port) {
    return this.load().get(this.key(host, port)) || null;
  }

  /**
   * Look the host up in the OpenSSH known_hosts seed files (non-hashed
   * entries only) and return the first match, or null.
   */
  lookupSystemKnownHosts(host, port, customFile) {
    const files = [];
    if (customFile) files.push(customFile);
    else if (Array.isArray(this.knownHostsFiles)) files.push(...this.knownHostsFiles);
    for (const file of files) {
      if (!file) continue;
      const map = parseKnownHosts(file);
      const direct = map.get(host);
      if (direct) return { ...direct, source: file };
      const withPort = map.get(`[${host}]:${port || 22}`);
      if (withPort) return { ...withPort, source: file };
    }
    return null;
  }

  record(host, port, fingerprint, algorithm, source = 'tofu') {
    const entries = this.load();
    const entry = { fingerprint, algorithm: algorithm || '', source, recordedAt: new Date().toISOString() };
    entries.set(this.key(host, port), entry);
    try {
      fs.mkdirSync(path.dirname(this.storeFile), { recursive: true });
      fs.writeFileSync(this.storeFile, JSON.stringify(Object.fromEntries(entries), null, 2) + '\n', { mode: 0o600 });
    } catch {
      // best-effort persistence; in-memory entry still guards this session
    }
    return entry;
  }

  forget(host, port) {
    return this.load().delete(this.key(host, port));
  }
}
