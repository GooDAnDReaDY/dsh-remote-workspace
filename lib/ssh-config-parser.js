import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export class SshConfigParser {
  /**
   * Parse ssh config string into DSH remote profiles
   * @param {string} text
   * @returns {Array<any>}
   */
  static parse(text) {
    if (!text || typeof text !== 'string') return [];

    const lines = text.split('\n');
    const profiles = [];
    let current = null;

    for (let rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      // Key Value pair (can be separated by whitespace or '=')
      const match = line.match(/^(\w+)(?:\s+|=)(.+)$/);
      if (!match) continue;

      const key = match[1].toLowerCase();
      const val = match[2].trim().replace(/^["']|["']$/g, '');

      if (key === 'host') {
        // Skip wildcards like Host *
        if (val === '*' || val.includes('*') || val.includes('?')) {
          current = null;
          continue;
        }

        if (current && current.host) {
          profiles.push(current);
        }

        current = {
          id: `ssh-cfg-${val.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`,
          name: val,
          host: val,
          port: 22,
          username: os.userInfo().username || 'root',
          authType: 'key',
          privateKey: '~/.ssh/id_ed25519',
          remoteProjectDir: '/root',
          jumpHostId: ''
        };
      } else if (current) {
        if (key === 'hostname') {
          current.host = val;
        } else if (key === 'user') {
          current.username = val;
        } else if (key === 'port') {
          const p = parseInt(val, 10);
          if (p > 0 && p < 65536) current.port = p;
        } else if (key === 'identityfile') {
          current.authType = 'key';
          current.privateKey = val;
        } else if (key === 'proxyjump') {
          current.jumpHostId = val;
        }
      }
    }

    if (current && current.host) {
      profiles.push(current);
    }

    return profiles;
  }

  /**
   * Load local default ~/.ssh/config if exists
   */
  static readDefaultConfig() {
    const configPath = path.join(os.homedir(), '.ssh', 'config');
    if (fs.existsSync(configPath)) {
      try {
        return fs.readFileSync(configPath, 'utf8');
      } catch {
        return '';
      }
    }
    return '';
  }
}
