import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export class DockerService {
  /**
   * @param {import('./ssh-service.js').SshService} sshService
   */
  constructor(sshService) {
    this.sshService = sshService;
    /** @type {Map<string, {
     *   tcpServer: net.Server | null,
     *   unixServer: net.Server | null,
     *   localSocketPath: string | null,
     *   localTcpPort: number,
     *   remoteSocketPath: string,
     *   profileId: string,
     *   createdAt: number,
     *   activeConnections: number,
     *   bytesRx: number,
     *   bytesTx: number
     * }>} */
    this.activeSocketForwards = new Map();
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
      } catch (err) {
        this.lastParseError = err;
      }
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
    const safeContainerId = "'" + String(containerId || '').replace(/'/g, "'\\''") + "'";
    const cmd = `docker ${action} ${safeContainerId} 2>/dev/null || podman ${action} ${safeContainerId}`;
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
    const safeTail = Math.max(1, Math.min(10000, parseInt(tail, 10) || 100));
    const safeContainerId = "'" + String(containerId || '').replace(/'/g, "'\\''") + "'";
    const cmd = `docker logs --tail ${safeTail} ${safeContainerId} 2>&1 || podman logs --tail ${safeTail} ${safeContainerId} 2>&1`;
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

  /**
   * Check remote Docker socket existence, accessibility, and daemon status (#135)
   */
  async checkDockerSocket(profile, remoteSocketPath = '/var/run/docker.sock') {
    const safePath = "'" + String(remoteSocketPath || '/var/run/docker.sock').replace(/'/g, "'\\''") + "'";
    const checkCmd = `test -S ${safePath} && echo "SOCKET_EXISTS" || echo "NO_SOCKET"`;
    const resSocket = await this.sshService.exec(profile, checkCmd);
    const exists = resSocket.stdout.includes('SOCKET_EXISTS');

    const permCmd = `test -r ${safePath} -a -w ${safePath} && echo "PERM_OK" || echo "PERM_DENIED"`;
    const resPerm = await this.sshService.exec(profile, permCmd);
    const permissionsOk = resPerm.stdout.includes('PERM_OK');

    const daemonCmd = `docker info >/dev/null 2>&1 && echo "DAEMON_UP" || (podman info >/dev/null 2>&1 && echo "DAEMON_UP" || echo "DAEMON_DOWN")`;
    const resDaemon = await this.sshService.exec(profile, daemonCmd);
    const daemonRunning = resDaemon.stdout.includes('DAEMON_UP');

    let error = null;
    if (!exists) {
      error = `Socket ${remoteSocketPath} does not exist on remote host`;
    } else if (!permissionsOk) {
      error = `Current remote user cannot read/write ${remoteSocketPath} (may require adding user to docker group)`;
    } else if (!daemonRunning) {
      error = 'Docker/Podman daemon is not responding on remote host';
    }

    return {
      available: exists && permissionsOk && daemonRunning,
      exists,
      permissionsOk,
      daemonRunning,
      error
    };
  }

  /**
   * Allocate free TCP port locally
   */
  async allocateFreePort() {
    return new Promise((resolve, reject) => {
      const srv = net.createServer();
      srv.unref();
      srv.on('error', reject);
      srv.listen(0, '127.0.0.1', () => {
        const port = srv.address().port;
        srv.close((err) => {
          if (err) return reject(err);
          resolve(port);
        });
      });
    });
  }

  /**
   * Forward remote Docker socket over SSH stream (#135)
   * Exposes both a local TCP proxy (http://127.0.0.1:<port>) and a local Unix domain socket
   */
  async forwardDockerSocket(profile, options = {}) {
    if (!profile || !profile.id) {
      throw new Error('Valid profile is required for docker socket forwarding');
    }
    const profileId = profile.id;
    const remoteSocketPath = options.remoteSocketPath || '/var/run/docker.sock';

    // Stop existing forward if active
    if (this.activeSocketForwards.has(profileId)) {
      this.stopSocketForward(profileId);
    }

    const localTcpPort = options.localPort ? parseInt(options.localPort, 10) : await this.allocateFreePort();
    const isWindows = process.platform === 'win32';
    const localSocketPath = isWindows ? null : (options.localSocketPath || path.join(os.tmpdir(), `dsh-docker-${profileId}.sock`));

    if (localSocketPath && fs.existsSync(localSocketPath)) {
      try {
        fs.unlinkSync(localSocketPath);
      } catch (e) {
        this.lastUnlinkError = e;
      }
    }

    const conn = await this.sshService.getConnection(profile);

    const forwardMeta = {
      profileId,
      remoteSocketPath,
      localTcpPort,
      localSocketPath,
      tcpServer: null,
      unixServer: null,
      createdAt: Date.now(),
      activeConnections: 0,
      bytesRx: 0,
      bytesTx: 0
    };

    const handleClientConnection = (clientSocket) => {
      forwardMeta.activeConnections++;

      if (typeof conn.openssh_forwardOutStreamLocal === 'function') {
        conn.openssh_forwardOutStreamLocal(remoteSocketPath, (err, remoteStream) => {
          if (err) {
            forwardMeta.activeConnections = Math.max(0, forwardMeta.activeConnections - 1);
            clientSocket.destroy();
            return;
          }

          clientSocket.on('data', (chunk) => {
            forwardMeta.bytesRx += chunk.length;
          });
          remoteStream.on('data', (chunk) => {
            forwardMeta.bytesTx += chunk.length;
          });

          clientSocket.pipe(remoteStream);
          remoteStream.pipe(clientSocket);

          let ended = false;
          const cleanup = () => {
            if (ended) return;
            ended = true;
            forwardMeta.activeConnections = Math.max(0, forwardMeta.activeConnections - 1);
            try { clientSocket.destroy(); } catch (e) { this.lastStreamError = e; }
            try { remoteStream.destroy(); } catch (e) { this.lastStreamError = e; }
          };

          clientSocket.on('close', cleanup);
          clientSocket.on('error', cleanup);
          remoteStream.on('close', cleanup);
          remoteStream.on('error', cleanup);
        });
      } else {
        // Fallback: spawn remote nc/socat bridge
        conn.exec(`nc -U '${remoteSocketPath}' 2>/dev/null || socat - UNIX-CONNECT:'${remoteSocketPath}'`, (err, stream) => {
          if (err) {
            forwardMeta.activeConnections = Math.max(0, forwardMeta.activeConnections - 1);
            clientSocket.destroy();
            return;
          }
          clientSocket.pipe(stream);
          stream.pipe(clientSocket);

          let ended = false;
          const cleanup = () => {
            if (ended) return;
            ended = true;
            forwardMeta.activeConnections = Math.max(0, forwardMeta.activeConnections - 1);
            try { clientSocket.destroy(); } catch (e) { this.lastStreamError = e; }
            try { stream.destroy(); } catch (e) { this.lastStreamError = e; }
          };

          clientSocket.on('close', cleanup);
          clientSocket.on('error', cleanup);
          stream.on('close', cleanup);
          stream.on('error', cleanup);
        });
      }
    };

    // Start TCP server
    await new Promise((resolve, reject) => {
      const tcpServer = net.createServer(handleClientConnection);
      tcpServer.on('error', reject);
      tcpServer.listen(localTcpPort, '127.0.0.1', () => {
        forwardMeta.tcpServer = tcpServer;
        resolve(true);
      });
    });

    // Start Unix domain socket server if supported
    if (localSocketPath) {
      await new Promise((resolve) => {
        const unixServer = net.createServer(handleClientConnection);
        unixServer.on('error', (e) => {
          this.lastUnixServerError = e;
          resolve(false);
        });
        unixServer.listen(localSocketPath, () => {
          forwardMeta.unixServer = unixServer;
          resolve(true);
        });
      });
    }

    this.activeSocketForwards.set(profileId, forwardMeta);
    if (typeof this.sshService.setPinned === 'function') {
      this.sshService.setPinned(profileId, true);
    }

    return {
      success: true,
      profileId,
      remoteSocketPath,
      localTcpPort,
      localSocketPath,
      tcpUrl: `http://127.0.0.1:${localTcpPort}`,
      createdAt: forwardMeta.createdAt
    };
  }

  /**
   * Stop active Docker socket forward for a profile (#135)
   */
  stopSocketForward(profileId) {
    const forward = this.activeSocketForwards.get(profileId);
    if (!forward) return false;

    if (forward.tcpServer) {
      try {
        forward.tcpServer.close();
      } catch (err) {
        this.lastServerCloseError = err;
      }
    }
    if (forward.unixServer) {
      try {
        forward.unixServer.close();
      } catch (err) {
        this.lastServerCloseError = err;
      }
    }
    if (forward.localSocketPath && fs.existsSync(forward.localSocketPath)) {
      try {
        fs.unlinkSync(forward.localSocketPath);
      } catch (err) {
        this.lastUnlinkError = err;
      }
    }

    this.activeSocketForwards.delete(profileId);

    if (typeof this.sshService.setPinned === 'function') {
      this.sshService.setPinned(profileId, false);
    }

    return true;
  }

  /**
   * Get socket forward status for a profile (#135)
   */
  getSocketStatus(profileId) {
    const forward = this.activeSocketForwards.get(profileId);
    if (!forward) {
      return {
        active: false,
        profileId,
        localTcpPort: null,
        localSocketPath: null,
        remoteSocketPath: null,
        uptimeSeconds: 0,
        activeConnections: 0,
        bytesRx: 0,
        bytesTx: 0
      };
    }
    return {
      active: true,
      profileId,
      localTcpPort: forward.localTcpPort,
      localSocketPath: forward.localSocketPath,
      remoteSocketPath: forward.remoteSocketPath,
      tcpUrl: `http://127.0.0.1:${forward.localTcpPort}`,
      createdAt: forward.createdAt,
      uptimeSeconds: Math.floor((Date.now() - forward.createdAt) / 1000),
      activeConnections: forward.activeConnections,
      bytesRx: forward.bytesRx,
      bytesTx: forward.bytesTx
    };
  }

  /**
   * List all active socket forwards (#135)
   */
  listActiveSocketForwards() {
    return Array.from(this.activeSocketForwards.keys()).map((id) => this.getSocketStatus(id));
  }

  /**
   * Helper for @goodandready/dsh-docker-dashboard synergy (#135)
   * Returns active Docker socket/TCP endpoint
   */
  getActiveDockerEndpoint(preferredProfileId = null) {
    let s = null;
    if (preferredProfileId && this.activeSocketForwards.has(preferredProfileId)) {
      s = this.getSocketStatus(preferredProfileId);
    } else {
      for (const [id] of this.activeSocketForwards.entries()) {
        s = this.getSocketStatus(id);
        break;
      }
    }
    if (s && s.active) {
      return {
        ...s,
        tcpPort: s.localTcpPort,
        socketPath: s.localSocketPath
      };
    }
    return {
      active: false,
      profileId: null,
      tcpPort: null,
      socketPath: null,
      localTcpPort: null,
      localSocketPath: null,
      remoteSocketPath: null,
      tcpUrl: null
    };
  }

  /**
   * Cleanup on plugin dispose
   */
  stopAll() {
    for (const [profileId] of this.activeSocketForwards.entries()) {
      this.stopSocketForward(profileId);
    }
  }
}
