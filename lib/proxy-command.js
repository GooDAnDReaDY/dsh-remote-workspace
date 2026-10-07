import { spawn } from 'node:child_process';
import { Duplex } from 'node:stream';

const TOKEN = /%[%hprn]/g;

/**
 * Validate that a ProxyCommand template does not contain dangerous shell chaining or redirection metacharacters.
 * @param {string} template
 */
export function validateProxyCommandTemplate(template) {
  if (!template || typeof template !== 'string') return;
  const trimmed = template.trim();
  if (!trimmed) return;
  if (/[\n\r;&|`$><]/.test(trimmed)) {
    const err = new Error('ProxyCommand must not contain shell chaining or interpolation metacharacters (;, &, |, `, $, >, <, newlines)');
    err.statusCode = 400;
    throw err;
  }
}

/**
 * Shell-quote a token value for safe interpolation into ProxyCommand.
 * @param {any} arg
 */
export function shellQuoteToken(arg) {
  if (arg === '' || arg === undefined || arg === null) return "''";
  const str = String(arg);
  if (/^[A-Za-z0-9_.:-]+$/.test(str)) {
    return str;
  }
  return `'${str.replace(/'/g, "'\\''")}'`;
}

/**
 * Expand OpenSSH ProxyCommand tokens. %% stays a literal percent.
 * @param {string} template
 * @param {{ host?: string, port?: number|string, user?: string, alias?: string }} tokens
 */
export function expandProxyCommand(template, tokens = {}) {
  if (!template || typeof template !== 'string') return '';
  validateProxyCommandTemplate(template);

  const safePort = String(parseInt(tokens.port, 10) || (tokens.port ? String(tokens.port).replace(/\D/g, '') : '22'));
  const map = {
    '%h': shellQuoteToken(tokens.host),
    '%p': safePort,
    '%r': shellQuoteToken(tokens.user),
    '%n': shellQuoteToken(tokens.alias),
    '%%': '%'
  };
  return String(template).replace(TOKEN, (token) => (token in map ? map[token] : token));
}

/**
 * Run a ProxyCommand and expose its stdio as a duplex socket for ssh2.
 * POSIX uses `$SHELL -c`; Windows uses `cmd.exe /d /s /c`.
 * @param {string} command
 */
export function openProxyCommand(command) {
  if (!command || typeof command !== 'string' || !command.trim()) {
    throw new Error('ProxyCommand must be a non-empty string');
  }
  if (/[\n\r]/.test(command)) {
    throw new Error('ProxyCommand must not contain newlines');
  }

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
