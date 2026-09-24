export function isRetryableConnectionError(err) {
  if (!err || err.commandTimeout) return false;
  if (err.stdout) return false;
  const code = err.code || '';
  if (['ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENOTFOUND', 'EPIPE'].includes(code)) return true;
  return /connection reset|not connected|No response from server|socket hang up/i.test(String(err.message || ''));
}

export async function runWithReconnect(run, options = {}) {
  const attempts = options.idempotent === false ? 1 : 3;
  const wait = options.wait || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await run();
    } catch (err) {
      lastError = err;
      if (attempt >= attempts || !isRetryableConnectionError(err)) throw err;
      if (options.onRetry) options.onRetry(err, attempt);
      await wait(50 * attempt);
    }
  }
  throw lastError;
}
