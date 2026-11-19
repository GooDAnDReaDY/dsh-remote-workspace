/**
 * Canonical shell quoting shared by every service that interpolates values
 * into remote commands (#172). One implementation instead of four drifting
 * copies (remote-fs-service, tar-sync-service, docker-service, proxy-command).
 */

/**
 * Quote an argument for safe interpolation into a POSIX shell command.
 * Non-string inputs are coerced; empty input yields ''.
 */
export function shellQuote(arg) {
  if (typeof arg !== 'string') arg = String(arg || '');
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}

/**
 * Quote a single ProxyCommand token value. Safe tokens stay unquoted for
 * readability; everything else goes through the canonical quoting.
 */
export function shellQuoteToken(arg) {
  if (arg === '' || arg === undefined || arg === null) return "''";
  const str = String(arg);
  if (/^[A-Za-z0-9_.:-]+$/.test(str)) {
    return str;
  }
  return shellQuote(str);
}
