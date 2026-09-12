export class HealthService {
  /**
   * @param {import('./ssh-service.js').SshService} sshService
   */
  constructor(sshService) {
    this.sshService = sshService;
    /** @type {Map<string, { data: any, expiresAt: number }>} */
    this.cache = new Map();
    this.cacheTtlMs = 4000;
  }

  async getHealth(profile, bypassCache = false) {
    if (!profile || !profile.host) {
      throw new Error('Invalid profile');
    }

    const cacheKey = profile.id;
    if (!bypassCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }
    }

    // Single compact shell command to gather all stats at once:
    // 1. uptime (load averages)
    // 2. memory (free -m)
    // 3. disk usage (df -k /)
    // 4. cpu info (cores & idle via /proc/stat or top)
    const probeCmd = `
echo "---UPTIME---"
uptime 2>/dev/null || true
echo "---MEM---"
free -m 2>/dev/null || true
echo "---DISK---"
df -m / 2>/dev/null || df -m . 2>/dev/null || true
echo "---CPU---"
grep 'cpu ' /proc/stat 2>/dev/null || true
`;

    const res = await this.sshService.exec(profile, probeCmd);
    const text = res.stdout || '';

    const uptimeMatch = text.match(/---UPTIME---\n([\s\S]*?)(?=---MEM---)/);
    const memMatch = text.match(/---MEM---\n([\s\S]*?)(?=---DISK---)/);
    const diskMatch = text.match(/---DISK---\n([\s\S]*?)(?=---CPU---)/);

    // 1. Parse Uptime & Load Avg
    let uptimeStr = 'Unknown';
    let loadAvg = [0, 0, 0];
    if (uptimeMatch) {
      const upLine = uptimeMatch[1].trim();
      const loadMatch = upLine.match(/load average[s]?:\s*([\d.]+),?\s*([\d.]+),?\s*([\d.]+)/);
      if (loadMatch) {
        loadAvg = [parseFloat(loadMatch[1]), parseFloat(loadMatch[2]), parseFloat(loadMatch[3])];
      }
      const upPart = upLine.match(/up\s+(.*?),\s+\d+\s+user/);
      if (upPart) uptimeStr = upPart[1];
      else uptimeStr = upLine.split(',')[0] || 'Online';
    }

    // 2. Parse Memory
    let memTotal = 0;
    let memUsed = 0;
    let memPercent = 0;
    if (memMatch) {
      const memLines = memMatch[1].trim().split('\n');
      for (const line of memLines) {
        if (line.startsWith('Mem:')) {
          const parts = line.split(/\s+/);
          memTotal = parseInt(parts[1], 10) || 0;
          memUsed = parseInt(parts[2], 10) || 0;
          if (memTotal > 0) {
            memPercent = Math.round((memUsed / memTotal) * 100);
          }
          break;
        }
      }
    }

    // 3. Parse Disk
    let diskTotal = 0;
    let diskUsed = 0;
    let diskPercent = 0;
    if (diskMatch) {
      const diskLines = diskMatch[1].trim().split('\n');
      if (diskLines.length > 1) {
        const parts = diskLines[1].split(/\s+/);
        diskTotal = parseInt(parts[1], 10) || 0;
        diskUsed = parseInt(parts[2], 10) || 0;
        const pStr = parts[4] || '';
        diskPercent = parseInt(pStr.replace('%', ''), 10) || (diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0);
      }
    }

    const result = {
      ok: true,
      timestamp: Date.now(),
      uptime: uptimeStr,
      loadAverage: loadAvg,
      cpuLoad: Math.min(100, Math.round(loadAvg[0] * 25)), // Normalized approx representation
      memory: {
        totalMb: memTotal,
        usedMb: memUsed,
        percent: memPercent
      },
      disk: {
        totalMb: diskTotal,
        usedMb: diskUsed,
        percent: diskPercent
      }
    };

    this.cache.set(cacheKey, { data: result, expiresAt: Date.now() + this.cacheTtlMs });
    return result;
  }
}
