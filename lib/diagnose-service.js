export class DiagnoseService {
  /**
   * @param {import('./ssh-service.js').SshService} sshService
   */
  constructor(sshService) {
    this.sshService = sshService;
  }

  /**
   * Diagnose system aspects on remote host
   * @param {any} profile
   * @param {'ports'|'disk'|'memory'|'oom_killer'|'service_logs'} category
   * @param {string} [target] optional port, service name, or path
   */
  async diagnose(profile, category, target = '') {
    if (!profile || !profile.host) throw new Error('Invalid profile');

    let cmd = '';
    switch (category) {
      case 'ports': {
        const filter = target ? `grep ':${target} '` : 'cat';
        cmd = `(ss -tulpn 2>/dev/null || netstat -tulpn 2>/dev/null || lsof -i -P -n 2>/dev/null) | ${filter} | head -n 40`;
        break;
      }
      case 'disk': {
        const path = target || '/';
        cmd = `df -h ${path} 2>/dev/null; echo "---TOP 10 DIRS---"; du -ahx ${path} 2>/dev/null | sort -rh | head -n 10`;
        break;
      }
      case 'memory': {
        cmd = `free -h 2>/dev/null || free -m; echo "---TOP 10 PROCESSES BY RAM---"; ps aux --sort=-%mem 2>/dev/null | head -n 11`;
        break;
      }
      case 'oom_killer': {
        cmd = `(dmesg -T 2>/dev/null || dmesg 2>/dev/null) | grep -i -E 'oom|out of memory|killed process' | tail -n 25 || echo "No OOM events detected"`;
        break;
      }
      case 'service_logs': {
        if (!target) throw new Error('Target service name required for service_logs');
        const safeName = target.replace(/[^a-zA-Z0-9_.-]/g, '');
        cmd = `(journalctl -u ${safeName} -n 40 --no-pager 2>/dev/null || pm2 logs ${safeName} --lines 40 --nostream 2>/dev/null || tail -n 40 /var/log/${safeName}.log 2>/dev/null || echo "No logs found for ${safeName}")`;
        break;
      }
      default:
        throw new Error(`Unsupported diagnosis category: ${category}`);
    }

    const res = await this.sshService.exec(profile, cmd);
    const code = res.code !== undefined ? res.code : (res.exitCode !== undefined ? res.exitCode : 0);
    return {
      ok: code === 0,
      category,
      target: target || null,
      output: (res.stdout || res.stderr || '').trim()
    };
  }
}
