import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import ssh2Pkg from 'ssh2';
import crypto from 'node:crypto';
import { SshService } from '../lib/ssh-service.js';
import { TunnelService } from '../lib/tunnel-service.js';

const { Server } = ssh2Pkg;

const { privateKey: hostKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
});

test('Integration: SSH Local Port Forwarding tunnel', async () => {
  let sshServer;
  let targetHttpServer;
  let sshPort = 0;
  let targetPort = 0;

  // 1. Target server that responds to requests (simulating a service on remote host)
  await new Promise((resolve) => {
    targetHttpServer = net.createServer((socket) => {
      socket.on('data', () => {
        socket.write('HTTP/1.1 200 OK\r\nContent-Length: 13\r\n\r\nHello Remote!');
        socket.end();
      });
    });
    targetHttpServer.listen(0, '127.0.0.1', () => {
      targetPort = targetHttpServer.address().port;
      resolve();
    });
  });

  // 2. Mock SSH Server supporting forwardOut
  await new Promise((resolve) => {
    sshServer = new Server({ hostKeys: [hostKey] }, (client) => {
      client.on('authentication', (ctx) => ctx.accept());
      client.on('ready', () => {
        client.on('tcpip', (accept, reject, info) => {
          // Connect to the target service
          const targetSocket = net.connect(info.destPort, info.destIP, () => {
            const channel = accept();
            channel.pipe(targetSocket).pipe(channel);
          });
          targetSocket.on('error', () => reject());
        });
      });
    });
    sshServer.listen(0, '127.0.0.1', () => {
      sshPort = sshServer.address().port;
      resolve();
    });
  });

  const sshService = new SshService({});
  const tunnelService = new TunnelService(sshService);

  const profile = {
    id: 'tunnel-box',
    host: '127.0.0.1',
    port: sshPort,
    username: 'tunneluser',
    authType: 'password',
    password: 'any'
  };

  try {
    // 3. Start local tunnel
    const localPort = 23456;
    const tunnelResult = await tunnelService.startLocalTunnel(profile, localPort, '127.0.0.1', targetPort);
    assert.equal(tunnelResult.success, true);
    assert.equal(tunnelService.listActiveTunnels().length, 1);

    // 4. Send request through the tunnel to 127.0.0.1:localPort
    const response = await new Promise((resolve, reject) => {
      const client = net.connect(localPort, '127.0.0.1', () => {
        client.write('GET / HTTP/1.1\r\nHost: localhost\r\n\r\n');
      });
      let data = '';
      client.on('data', (d) => { data += d.toString(); });
      client.on('end', () => resolve(data));
      client.on('error', reject);
    });

    assert.match(response, /Hello Remote!/);

    // 5. Stop tunnel
    const stopped = tunnelService.stopTunnel(tunnelResult.tunnelId);
    assert.equal(stopped, true);
    assert.equal(tunnelService.listActiveTunnels().length, 0);
  } finally {
    tunnelService.stopAll();
    sshService.disconnectAll();
    await new Promise((r) => sshServer.close(r));
    await new Promise((r) => targetHttpServer.close(r));
  }
});
