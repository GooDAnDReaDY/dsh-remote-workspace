import test from 'node:test';
import assert from 'node:assert/strict';
import ssh2Pkg from 'ssh2';
import crypto from 'node:crypto';
import { SshService } from '../lib/ssh-service.js';

const { Server } = ssh2Pkg;

// Generate ephemeral host key for mock SSH server
const { privateKey: hostKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
});

test('Integration: Connect to mock SSH server and execute command', async (t) => {
  let server;
  const mockPort = 22224;

  await new Promise((resolve) => {
    server = new Server({ hostKeys: [hostKey] }, (client) => {
      client.on('authentication', (ctx) => {
        if (ctx.method === 'password' && ctx.username === 'testuser' && ctx.password === 'secret123') {
          ctx.accept();
        } else {
          ctx.reject(['password']);
        }
      });

      client.on('ready', () => {
        client.on('session', (accept) => {
          const session = accept();
          session.on('exec', (accept, reject, info) => {
            const stream = accept();
            if (info.command.includes('uname') || info.command.includes('ver')) {
              stream.write('Linux MockOS 6.8.0 x86_64\n');
              stream.exit(0);
              stream.end();
            } else if (info.command === 'echo hello') {
              stream.write('hello\n');
              stream.exit(0);
              stream.end();
            } else {
              stream.stderr.write('command not found\n');
              stream.exit(127);
              stream.end();
            }
          });
        });
      });
    });

    server.listen(mockPort, '127.0.0.1', () => {
      resolve();
    });
  });

  const sshService = new SshService({});

  const profile = {
    id: 'mock-box',
    host: '127.0.0.1',
    port: mockPort,
    username: 'testuser',
    authType: 'password',
    password: 'secret123'
  };

  // 1. Test connection probe
  const testRes = await sshService.testConnection(profile);
  assert.equal(testRes.success, true);
  assert.match(testRes.os, /MockOS/);
  assert.equal(typeof testRes.latency, 'number');

  // 2. Exec command
  const execRes = await sshService.exec(profile, 'echo hello');
  assert.equal(execRes.code, 0);
  assert.equal(execRes.stdout.trim(), 'hello');

  // 3. Failed auth test
  const badProfile = {
    ...profile,
    id: 'bad-box',
    password: 'wrong-password'
  };
  await assert.rejects(
    async () => {
      await sshService.getConnection(badProfile);
    },
    /authentication|failed/i
  );

  // Teardown
  sshService.disconnectAll();
  await new Promise((resolve) => server.close(resolve));
});
