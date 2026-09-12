export class DockerService {
  /**
   * @param {import('./ssh-service.js').SshService} sshService
   */
  constructor(sshService) {
    this.sshService = sshService;
  }

  /**
   * List active or all containers with JSON formatting
   */
  async listContainers(profile, all = true) {
    // Detect docker or podman
    const flag = all ? '-a' : '';
    // Format as line-delimited JSON or tabbed format
    const cmd = `docker ps ${flag} --format '{{json .}}' 2>/dev/null || podman ps ${flag} --format '{{json .}}' 2>/dev/null`;
    const res = await this.sshService.exec(profile, cmd);

    if (res.code !== 0 && !res.stdout.trim()) {
      return {
        available: false,
        error: res.stderr || 'Docker not found or daemon not running',
        containers: []
      };
    }

    const containers = [];
    const lines = res.stdout.split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const item = JSON.parse(line);
        containers.push({
          id: item.ID || item.Id || '',
          names: item.Names || item.Name || '',
          image: item.Image || '',
          status: item.Status || '',
          state: (item.State || '').toLowerCase(),
          ports: item.Ports || '',
          created: item.CreatedAt || item.Created || ''
        });
      } catch (_) {}
    }

    return {
      available: true,
      containers
    };
  }

  /**
   * Container action: start, stop, restart, pause, unpause
   */
  async containerAction(profile, containerId, action) {
    const validActions = ['start', 'stop', 'restart', 'pause', 'unpause', 'rm'];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid container action: ${action}`);
    }
    const cmd = `docker ${action} ${JSON.stringify(containerId)} 2>/dev/null || podman ${action} ${JSON.stringify(containerId)}`;
    const res = await this.sshService.exec(profile, cmd);
    return {
      success: res.code === 0,
      stdout: res.stdout.trim(),
      stderr: res.stderr.trim()
    };
  }

  /**
   * Fetch container logs
   */
  async containerLogs(profile, containerId, tail = 100) {
    const cmd = `docker logs --tail ${tail} ${JSON.stringify(containerId)} 2>&1 || podman logs --tail ${tail} ${JSON.stringify(containerId)} 2>&1`;
    const res = await this.sshService.exec(profile, cmd);
    return {
      success: res.code === 0,
      logs: res.stdout || res.stderr || ''
    };
  }

  /**
   * Docker compose lifecycle
   */
  async composeAction(profile, cwd, action = 'ps') {
    const valid = ['up -d', 'down', 'ps', 'restart', 'pull'];
    const safeAction = valid.includes(action) ? action : 'ps';
    const cmd = `docker compose ${safeAction} 2>/dev/null || docker-compose ${safeAction} 2>/dev/null || podman-compose ${safeAction}`;
    const res = await this.sshService.exec(profile, cmd, cwd);
    return {
      success: res.code === 0,
      stdout: res.stdout,
      stderr: res.stderr
    };
  }
}
