export class AlertService {
  /**
   * @param {any} ctx
   * @param {import('./health-service.js').HealthService} healthService
   * @param {import('./docker-service.js').DockerService} dockerService
   */
  constructor(ctx, healthService, dockerService) {
    this.ctx = ctx;
    this.healthService = healthService;
    this.dockerService = dockerService;
    /** @type {NodeJS.Timeout|null} */
    this.timer = null;
    /** @type {Array<any>} */
    this.activeAlerts = [];
    this.checkIntervalMs = 5 * 60 * 1000; // 5 mins
    this.enabled = false;
  }

  start(intervalMs = 300000) {
    this.stop();
    this.checkIntervalMs = intervalMs;
    this.enabled = true;
    this.timer = setInterval(() => this.check(), this.checkIntervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.enabled = false;
  }

  /**
   * Run single alert check across active profile
   */
  async check(profile) {
    if (!profile) return [];

    const alerts = [];
    try {
      // 1. Health check
      const health = await this.healthService.getHealth(profile, true);
      if (health.disk && health.disk.percent >= 90) {
        alerts.push({
          id: `disk-${Date.now()}`,
          level: health.disk.percent >= 95 ? 'critical' : 'warning',
          type: 'disk_full',
          message: `Disk usage on ${profile.name || profile.host} is ${health.disk.percent}%`,
          timestamp: Date.now()
        });
      }

      if (health.memory && health.memory.percent >= 95) {
        alerts.push({
          id: `mem-${Date.now()}`,
          level: 'warning',
          type: 'memory_high',
          message: `Memory usage on ${profile.name || profile.host} is ${health.memory.percent}%`,
          timestamp: Date.now()
        });
      }

      // 2. Docker check
      if (this.dockerService) {
        try {
          const containers = await this.dockerService.listContainers(profile);
          for (const c of containers) {
            if (c.State === 'restarting' || (c.Status && c.Status.includes('Restarting'))) {
              alerts.push({
                id: `docker-${c.ID || c.Names}`,
                level: 'warning',
                type: 'container_restarting',
                message: `Container ${c.Names || c.ID} is restarting repeatedly`,
                timestamp: Date.now()
              });
            }
          }
        } catch {
          // Docker might not be installed or active, non-blocking
        }
      }
    } catch (err) {
      // If host unreachable
      alerts.push({
        id: `host-unreachable-${Date.now()}`,
        level: 'critical',
        type: 'host_unreachable',
        message: `Host ${profile.name || profile.host} unreachable: ${err.message}`,
        timestamp: Date.now()
      });
    }

    this.activeAlerts = alerts;

    // Emit Cordis event if ctx is present
    if (this.ctx && typeof this.ctx.emit === 'function' && alerts.length > 0) {
      for (const alert of alerts) {
        this.ctx.emit('remote-workspace/alert', alert);
      }
    }

    return alerts;
  }

  getAlerts() {
    return this.activeAlerts;
  }
}
