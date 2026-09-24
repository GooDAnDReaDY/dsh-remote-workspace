import net from 'node:net';

export class TunnelService {
  /**
   * @param {import('./ssh-service.js').SshService} sshService
   */
  constructor(sshService) {
    this.sshService = sshService;
    /** @type {Map<string, {
     *   server: net.Server,
     *   profileId: string,
     *   localPort: number,
     *   targetHost: string,
     *   remotePort: number,
     *   createdAt: number,
     *   bytesRx: number,
     *   bytesTx: number,
     *   totalConnections: number,
     *   activeConnections: number
     * }>} */
    this.activeTunnels = new Map();
  }

  /**
   * Start local port forwarding tunnel: LocalPort -> RemoteHost:RemotePort with live telemetry
   */
  async startLocalTunnel(profile, localPort, targetHost, remotePort) {
    const tunnelId = `${profile.id}:${localPort}->${targetHost}:${remotePort}`;
    if (this.activeTunnels.has(tunnelId)) {
      return { success: true, tunnelId, alreadyRunning: true };
    }

    const conn = await this.sshService.getConnection(profile);

    return new Promise((resolve, reject) => {
      const tunnelMeta = {
        server: null,
        profileId: profile.id,
        localPort,
        targetHost,
        remotePort,
        createdAt: Date.now(),
        bytesRx: 0,
        bytesTx: 0,
        totalConnections: 0,
        activeConnections: 0
      };

      const server = net.createServer((clientSocket) => {
        tunnelMeta.totalConnections++;
        tunnelMeta.activeConnections++;

        conn.forwardOut(
          '127.0.0.1',
          clientSocket.remotePort || 0,
          targetHost,
          remotePort,
          (err, stream) => {
            if (err) {
              tunnelMeta.activeConnections = Math.max(0, tunnelMeta.activeConnections - 1);
              clientSocket.destroy();
              return;
            }

            // Telemetry: measure bytes flowing through the tunnel
            clientSocket.on('data', (d) => {
              tunnelMeta.bytesRx += d.length;
            });
            stream.on('data', (d) => {
              tunnelMeta.bytesTx += d.length;
            });

            clientSocket.pipe(stream);
            stream.pipe(clientSocket);

            const cleanup = () => {
              tunnelMeta.activeConnections = Math.max(0, tunnelMeta.activeConnections - 1);
            };
            clientSocket.on('close', cleanup);
            clientSocket.on('error', cleanup);
            stream.on('close', cleanup);
            stream.on('error', cleanup);
          }
        );
      });

      tunnelMeta.server = server;

      server.on('error', (err) => {
        this.activeTunnels.delete(tunnelId);
        reject(err);
      });

      server.listen(localPort, '127.0.0.1', () => {
        this.activeTunnels.set(tunnelId, tunnelMeta);
        if (this.sshService.setPinned) this.sshService.setPinned(profile.id, true);
        resolve({
          success: true,
          tunnelId,
          localPort,
          targetHost,
          remotePort
        });
      });
    });
  }

  stopTunnel(tunnelId) {
    const tunnel = this.activeTunnels.get(tunnelId);
    if (!tunnel) return false;
    try {
      tunnel.server.close();
    } catch (err) { /* best-effort cleanup */ }
    this.activeTunnels.delete(tunnelId);
    const stillPinned = [...this.activeTunnels.values()].some((item) => item.profileId === tunnel.profileId);
    if (!stillPinned && this.sshService.setPinned) this.sshService.setPinned(tunnel.profileId, false);
    return true;
  }

  listActiveTunnels() {
    return Array.from(this.activeTunnels.entries()).map(([id, t]) => ({
      id,
      profileId: t.profileId,
      localPort: t.localPort,
      targetHost: t.targetHost,
      remotePort: t.remotePort,
      createdAt: t.createdAt,
      uptimeSeconds: Math.floor((Date.now() - t.createdAt) / 1000),
      bytesRx: t.bytesRx,
      bytesTx: t.bytesTx,
      totalConnections: t.totalConnections,
      activeConnections: t.activeConnections
    }));
  }

  stopAll() {
    for (const [id, tunnel] of this.activeTunnels.entries()) {
      try {
        tunnel.server.close();
      } catch (err) { /* best-effort cleanup */ }
    }
    this.activeTunnels.clear();
  }
}
