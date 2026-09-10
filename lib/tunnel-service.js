import net from 'node:net';

export class TunnelService {
  /**
   * @param {import('./ssh-service.js').SshService} sshService
   */
  constructor(sshService) {
    this.sshService = sshService;
    /** @type {Map<string, { server?: net.Server, profileId: string, localPort: number, targetHost: string, remotePort: number }>} */
    this.activeTunnels = new Map();
  }

  /**
   * Start Local Port Forwarding: 127.0.0.1:localPort -> Remote:targetHost:targetPort
   */
  async startLocalTunnel(profile, localPort, targetHost = '127.0.0.1', targetPort) {
    const tunnelId = `${profile.id}:${localPort}->${targetPort}`;
    if (this.activeTunnels.has(tunnelId)) {
      return { success: true, message: 'Tunnel already active', tunnelId, localPort, remotePort: targetPort };
    }

    const conn = await this.sshService.getConnection(profile);

    return new Promise((resolve, reject) => {
      const server = net.createServer((socket) => {
        conn.forwardOut(
          '127.0.0.1',
          socket.remotePort || 0,
          targetHost,
          targetPort,
          (err, stream) => {
            if (err) {
              try { socket.destroy(); } catch (_) {}
              return;
            }
            stream.on('error', () => {
              try { socket.destroy(); } catch (_) {}
            });
            socket.on('error', () => {
              try { stream.destroy(); } catch (_) {}
            });
            socket.pipe(stream).pipe(socket);
          }
        );
      });

      server.on('error', (err) => {
        this.activeTunnels.delete(tunnelId);
        reject(err);
      });

      server.listen(localPort, '127.0.0.1', () => {
        this.activeTunnels.set(tunnelId, {
          server,
          profileId: profile.id,
          localPort,
          targetHost,
          remotePort: targetPort
        });
        resolve({ success: true, tunnelId, localPort, targetHost, remotePort: targetPort });
      });
    });
  }

  /**
   * Stop active tunnel
   */
  stopTunnel(tunnelId) {
    const tunnel = this.activeTunnels.get(tunnelId);
    if (tunnel && tunnel.server) {
      try {
        tunnel.server.close();
      } catch (_) {}
      this.activeTunnels.delete(tunnelId);
      return true;
    }
    return false;
  }

  listActiveTunnels() {
    return Array.from(this.activeTunnels.entries()).map(([id, t]) => ({
      id,
      profileId: t.profileId,
      localPort: t.localPort,
      targetHost: t.targetHost || '127.0.0.1',
      remotePort: t.remotePort
    }));
  }

  stopAll() {
    for (const [id, t] of this.activeTunnels.entries()) {
      if (t.server) {
        try { t.server.close(); } catch (_) {}
      }
    }
    this.activeTunnels.clear();
  }
}
