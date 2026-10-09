import { validateProxyCommandTemplate } from './proxy-command.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function expandHome(value) {
  if (value.startsWith('~')) return path.join(os.homedir(), value.slice(1));
  return value;
}


export function isWithinDir(targetPath, parentDir) {
  if (!targetPath || !parentDir) return false;
  const normTarget = path.resolve(targetPath);
  const normParent = path.resolve(parentDir);
  const prefix = normParent.endsWith(path.sep) ? normParent : normParent + path.sep;
  return normTarget === normParent || normTarget.startsWith(prefix);
}

function defaultExpandInclude(pattern, baseDir, allowedRoot = null) {
  if (typeof pattern !== 'string' || !pattern.trim() || pattern.includes('\0')) {
    return [];
  }
  const expanded = expandHome(pattern.trim());
  const full = path.isAbsolute(expanded) ? path.resolve(expanded) : path.resolve(baseDir, expanded);
  if (allowedRoot && !isWithinDir(full, allowedRoot)) {
    return [];
  }
  if (full.includes('*') || full.includes('?')) {
    return fs.globSync(full, { windowsPathsNoEscape: true })
      .filter((file) => {
        try {
          const absFile = path.resolve(file);
          if (allowedRoot && !isWithinDir(absFile, allowedRoot)) return false;
          return fs.statSync(absFile).isFile();
        } catch {
          return false;
        }
      })
      .sort();
  }
  try {
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      return [full];
    }
  } catch {
    return [];
  }
  return [];
}


export class SshConfigParser {
  /**
   * @param {string} text
   * @param {{ baseDir?: string, expandInclude?: Function, readFile?: Function, seen?: Set<string>, knownIds?: Set<string> }} [options]
   */
  static parse(text, options = {}) {
    return this.parseReport(text, options).profiles;
  }

  static parseReport(text, options = {}) {
    const baseDir = options.baseDir || path.join(os.homedir(), '.ssh');
    const allowedRoot = options.allowedRoot !== undefined ? options.allowedRoot : (options.expandInclude ? null : baseDir);
    const expandInclude = options.expandInclude || ((pattern) => defaultExpandInclude(pattern, baseDir, allowedRoot));
    const readFile = options.readFile || ((file) => fs.readFileSync(file, 'utf8'));
    const seen = options.seen || new Set();
    const known = options.knownIds || new Set();
    const profiles = [];
    const skipped = [];
    let current = null;

    const pushCurrent = () => {
      if (!current || !current.host) {
        current = null;
        return;
      }
      if (known.has(current.id)) {
        skipped.push({ name: current.name, reason: 'duplicate' });
      } else {
        known.add(current.id);
        profiles.push(current);
      }
      current = null;
    };

    const lines = String(text || '').split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const match = line.match(/^(\w+)(?:\s+|=)(.+)$/);
      if (!match) continue;
      const key = match[1].toLowerCase();
      const val = match[2].trim().replace(/^["']|["']$/g, '');

      if (key === 'include') {
        pushCurrent();
        const files = expandInclude(val, baseDir);
        if (!files.length) {
          skipped.push({ name: val, reason: 'missing-include' });
          continue;
        }
        for (const file of files) {
          const abs = path.resolve(file);
          if (allowedRoot && !isWithinDir(abs, allowedRoot)) {
            skipped.push({ name: abs, reason: 'unauthorized-include' });
            continue;
          }
          if (seen.has(abs)) {
            skipped.push({ name: abs, reason: 'duplicate' });
            continue;
          }
          seen.add(abs);
          let nested = '';
          try { nested = readFile(abs); } catch {
            skipped.push({ name: abs, reason: 'missing-include' });
            continue;
          }
          const child = this.parseReport(nested, {
            baseDir: path.dirname(abs),
            allowedRoot,
            expandInclude: options.expandInclude,
            readFile,
            seen,
            knownIds: known
          });
          profiles.push(...child.profiles);
          skipped.push(...child.skipped);
        }
        continue;
      }

      if (key === 'match') {
        pushCurrent();
        skipped.push({ name: val, reason: 'match' });
        continue;
      }

      if (key === 'host') {
        pushCurrent();
        const names = val.split(/\s+/).filter(Boolean);
        const concrete = [];
        for (const name of names) {
          if (name === '*' || name.includes('*') || name.includes('?')) {
            skipped.push({ name, reason: 'wildcard' });
          } else {
            concrete.push(name);
          }
        }
        if (!concrete.length) continue;
        const name = concrete[0];
        current = {
          id: `ssh-cfg-${name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`,
          name,
          host: name,
          port: 22,
          username: os.userInfo().username || 'root',
          authType: 'key',
          privateKey: '~/.ssh/id_ed25519',
          remoteProjectDir: '/root',
          jumpHostId: ''
        };
        continue;
      }

      if (!current) continue;
      if (key === 'hostname') current.host = val;
      else if (key === 'user') current.username = val;
      else if (key === 'port') {
        const port = parseInt(val, 10);
        if (port > 0 && port < 65536) current.port = port;
      } else if (key === 'identityfile') {
        current.authType = 'key';
        current.privateKey = val;
      } else if (key === 'proxyjump') current.jumpHostId = val;
      else if (key === 'proxycommand') {
        try {
          validateProxyCommandTemplate(val);
          current.proxyCommand = val;
        } catch {
          skipped.push({ block: current.name || 'unnamed', reason: 'ProxyCommand contains forbidden shell metacharacters' });
        }
      }
    }
    pushCurrent();
    return { profiles, skipped };
  }

  static readDefaultConfig() {
    const configPath = path.join(os.homedir(), '.ssh', 'config');
    if (!fs.existsSync(configPath)) return '';
    try { return fs.readFileSync(configPath, 'utf8'); } catch { return ''; }
  }
}
