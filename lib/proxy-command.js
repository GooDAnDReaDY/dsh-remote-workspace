import { spawn } from 'node:child_process';
import { Duplex } from 'node:stream';

const TOKEN = /%[%hprn]/g;

/**
 * Expand OpenSSH ProxyCommand tokens. %% stays a literal percent.
 * @param {string} template
 * @param {{ host?: string, port?: number|string, user?: string, alias?: string }} tokens
 */
export function expandProxyCommand(template, tokens = {}) {
  const map = {
    '%h': String(tokens.host ?? ''),
    '%p': String(tokens.port ?? ''),
    '%r': String(tokens.user ?? ''),
    '%n': String(tokens.alias ?? ''),
    '%%': '%'
  };
  return String(template ?? '').replace(TOKEN, (token) => (token in map ? map[token] : token));
}

/**
 * Run a ProxyCommand and expose its stdio as a duplex socket for ssh2.
 * POSIX uses `$SHELL -c`; Windows uses `cmd.exe /d /s /c`.
 * @param {string} command
 */
export function openProxyCommand(command) {
  const windows = process.platform === 'win32';
  const shell = windows ? (process.env.ComSpec || 'cmd.exe') : (process.env.SHELL || '/bin/sh');
  const args = windows ? ['/d', '/s', '/c', command] : ['-c', command];
  const child = spawn(shell, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const sock = Duplex.from({ writable: child.stdin, readable: child.stdout });
  let stopped = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (child.exitCode !== null || child.signalCode) return;
    child.kill('SIGTERM');
    const timer = setTimeout(() => {
      if (child.exitCode === null && !child.signalCode) child.kill('SIGKILL');
    }, 2000);
    timer.unref?.();
    child.once('exit', () => clearTimeout(timer));
  };

  sock.on('close', stop);
  child.on('error', (err) => sock.destroy(err));
  child.on('exit', () => {
    if (!sock.destroyed) sock.destroy();
  });
  return { sock, child, stop };
}
