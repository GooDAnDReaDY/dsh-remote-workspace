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
    if (!key || typeof key !== 'string') throw new Error('Key must be non-empty string');

    let currentContent = '';
    try {
      currentContent = await this.remoteFsService.readFile(profile, filePath);
    } catch {
      currentContent = '';
    }

    const lines = currentContent ? currentContent.split('\n') : [];
    let updated = false;
    const newLines = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('#') && trimmed.includes('=')) {
        const k = trimmed.slice(0, trimmed.indexOf('=')).trim();
        if (k === key) {
          // Quote if contains spaces or special symbols
          const formattedVal = (value.includes(' ') || value.includes('\n')) ? `"${value}"` : value;
          newLines.push(`${key}=${formattedVal}`);
          updated = true;
          continue;
        }
      }
      newLines.push(line);
    }

    if (!updated) {
      const formattedVal = (value.includes(' ') || value.includes('\n')) ? `"${value}"` : value;
      if (newLines.length > 0 && newLines[newLines.length - 1].trim() !== '') {
        newLines.push('');
      }
      newLines.push(`${key}=${formattedVal}`);
    }

    const finalContent = newLines.join('\n');
    await this.remoteFsService.writeFile(profile, filePath, finalContent);

    return {
      ok: true,
      filePath,
      key,
      updated
    };
  }
}
