export class EnvService {
  /**
   * @param {import('./remote-fs-service.js').RemoteFsService} remoteFsService
   */
  constructor(remoteFsService) {
    this.remoteFsService = remoteFsService;
  }

  /**
   * Parse .env text into structured entries (preserving comments and order)
   * @param {string} text
   */
  parseEnv(text) {
    if (!text) return [];
    const lines = text.split('\n');
    const result = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) {
        result.push({ type: 'empty', raw: line });
        continue;
      }
      if (trimmed.startsWith('#')) {
        result.push({ type: 'comment', raw: line });
        continue;
      }

      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) {
        result.push({ type: 'raw', raw: line });
        continue;
      }

      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1);
      // Check if value is wrapped in quotes
      let isQuoted = false;
      const valTrimmed = val.trim();
      if ((valTrimmed.startsWith('"') && valTrimmed.endsWith('"')) ||
          (valTrimmed.startsWith("'") && valTrimmed.endsWith("'"))) {
        isQuoted = true;
        val = valTrimmed.slice(1, -1);
      }

      result.push({
        type: 'var',
        key,
        value: val,
        isQuoted,
        raw: line
      });
    }

    return result;
  }

  /**
   * Read and parse remote .env file
   */
  async readEnv(profile, filePath) {
    const content = await this.remoteFsService.readFile(profile, filePath);
    const parsed = this.parseEnv(content);
    return {
      filePath,
      entries: parsed,
      raw: content
    };
  }

  /**
   * Set or update variable in remote .env file atomically
   */
  async setEnvVar(profile, filePath, key, value) {
    const VALID_KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;
    if (!key || typeof key !== 'string' || !VALID_KEY_REGEX.test(key.trim())) {
      throw new Error(`Invalid environment variable key: "${key}". Key must match /^[A-Za-z_][A-Za-z0-9_]*$/ and contain no newlines or delimiters.`);
    }
    const cleanKey = key.trim();
    const strVal = String(value ?? '');

    let currentContent = '';
    try {
      currentContent = await this.remoteFsService.readFile(profile, filePath);
    } catch {
      currentContent = '';
    }

    const lines = currentContent ? currentContent.split('\n') : [];
    let updated = false;
    const newLines = [];

    const formatValue = (v) => {
      if (v.includes(' ') || v.includes('\n') || v.includes('"') || v.includes('=')) {
        return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`;
      }
      return v;
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('#') && trimmed.includes('=')) {
        const k = trimmed.slice(0, trimmed.indexOf('=')).trim();
        if (k === cleanKey) {
          newLines.push(`${cleanKey}=${formatValue(strVal)}`);
          updated = true;
          continue;
        }
      }
      newLines.push(line);
    }

    if (!updated) {
      if (newLines.length > 0 && newLines[newLines.length - 1].trim() !== '') {
        newLines.push('');
      }
      newLines.push(`${cleanKey}=${formatValue(strVal)}`);
    }

    const finalContent = newLines.join('\n');
    await this.remoteFsService.writeFile(profile, filePath, finalContent);

    return {
      ok: true,
      filePath,
      key: cleanKey,
      updated
    };
  }
}
