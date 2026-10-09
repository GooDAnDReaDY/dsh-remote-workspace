export function writeJson(res, statusCode, body) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.statusCode = statusCode;
  } else if (typeof res.writeHead === 'function') {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  } else {
    res.statusCode = statusCode;
  }
  res.end(JSON.stringify(body));
}

export const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MiB

export function readBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const rawCl = req?.headers?.['content-length'];
    const contentLength = rawCl !== undefined ? parseInt(Array.isArray(rawCl) ? rawCl[0] : rawCl, 10) : NaN;
    if (!isNaN(contentLength) && contentLength > maxBytes) {
      if (typeof req.destroy === 'function') req.destroy();
      const error = new Error('Payload too large');
      error.statusCode = 413;
      return reject(error);
    }

    let body = '';
    let bytesReceived = 0;
    let exceeded = false;

    function onData(chunk) {
      if (exceeded) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      bytesReceived += buffer.length;
      if (bytesReceived > maxBytes) {
        exceeded = true;
        if (typeof req.removeListener === 'function') {
          req.removeListener('data', onData);
        } else if (typeof req.off === 'function') {
          req.off('data', onData);
        }
        if (typeof req.destroy === 'function') req.destroy();
        const error = new Error('Payload too large');
        error.statusCode = 413;
        return reject(error);
      }
      body += buffer.toString('utf8');
    }

    req.on('data', onData);
    req.on('end', () => {
      if (exceeded) return;
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', (err) => {
      if (!exceeded) reject(err);
    });
  });
}

export function parseCookies(cookieHeader) {
  const cookies = {};
  if (typeof cookieHeader !== 'string') return cookies;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx !== -1) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  }
  return cookies;
}

export function isLoopbackAddress(address) {
  if (!address || typeof address !== 'string') return false;
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1' || address.startsWith('127.');
}

export function isTrustedSettingsRequest(req, expectedToken = null) {
  if (!req || !req.headers || typeof req.headers !== 'object') return false;
  const headers = req.headers;

  const secFetch = headers['sec-fetch-site'];
  // Fail-closed: unconditionally reject cross-site and non-same-origin Sec-Fetch-Site
  if (secFetch && secFetch !== 'same-origin') {
    return false;
  }

  // Reject invalid or mismatched origin when provided (CSRF protection)
  const origin = headers['origin'];
  const host = headers['host'];
  if (origin !== undefined) {
    if (origin === 'null' || !origin) return false;
    try {
      const originUrl = new URL(origin);
      if (host && originUrl.host !== host) return false;
    } catch {
      return false;
    }
  }

  const tokenCandidate = (typeof expectedToken === 'string' && expectedToken)
    || process.env.DSH_AUTH_TOKEN
    || process.env.DSH_TOKEN
    || null;

  const rawAuth = headers['authorization'];
  if (typeof rawAuth === 'string' && rawAuth.startsWith('Bearer ')) {
    const bearer = rawAuth.slice(7).trim();
    if (tokenCandidate && bearer && bearer === tokenCandidate) {
      return true;
    }
  }

  const cookieHeader = headers['cookie'];
  if (typeof cookieHeader === 'string' && tokenCandidate) {
    const cookies = parseCookies(cookieHeader);
    const token = cookies['token'] || cookies['dsh_token'];
    if (token && token === tokenCandidate) {
      return true;
    }
  }

  // If a token is configured but neither header nor cookie matched, reject
  if (tokenCandidate) {
    return false;
  }

  const ip = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  const hasRemote = Boolean(ip && typeof ip === 'string');
  const isLoopback = hasRemote && isLoopbackAddress(ip);

  // Non-loopback network callers require explicit token authentication
  if (hasRemote && !isLoopback) {
    return false;
  }

  // Browser same-origin navigation / fetch
  if (secFetch === 'same-origin') {
    return true;
  }

  // Local loopback caller (direct CLI / loopback curl)
  if (isLoopback) {
    return true;
  }

  return false;
}

export function getConnection(ctx) {
  try {
    return ctx?.reflect?.get ? ctx.reflect.get('connection') : (ctx?.get ? ctx.get('connection') : Reflect.get(ctx || {}, 'connection'));
  } catch {
    return undefined;
  }
}

export function authorizeRequest(sctx, req, res) {
  // First layer: Cross-origin / CSRF / remote network trust check
  if (!isTrustedSettingsRequest(req)) {
    writeJson(res, 403, { ok: false, error: 'Forbidden' });
    return false;
  }

  let connection;
  try {
    connection = getConnection(sctx);
  } catch {
    writeJson(res, 503, { ok: false, error: 'DSH browser authentication is unavailable' });
    return false;
  }

  if (!connection || typeof connection.requestRejection !== 'function') {
    writeJson(res, 503, { ok: false, error: 'DSH browser authentication is unavailable' });
    return false;
  }

  let rejection;
  try {
    rejection = connection.requestRejection(req);
  } catch {
    writeJson(res, 503, { ok: false, error: 'DSH browser authentication is unavailable' });
    return false;
  }

  if (rejection !== undefined) {
    const status = rejection === 401 ? 401 : 403;
    writeJson(res, status, {
      ok: false,
      error: status === 401 ? 'DSH browser authentication is required' : 'Forbidden'
    });
    return false;
  }

  return true;
}


export function validateRemotePath(filePath, options = {}) {
  const { allowEmpty = false, maxLength = 1024 } = options;
  if (!filePath && filePath !== '') {
    if (allowEmpty) return '';
    const err = new Error('A file path is required');
    err.statusCode = 400;
    err.status = 400;
    throw err;
  }
  if (typeof filePath !== 'string') {
    const err = new Error('File path must be a string');
    err.statusCode = 400;
    err.status = 400;
    throw err;
  }
  const trimmed = filePath.trim();
  if (!trimmed) {
    if (allowEmpty) return '';
    const err = new Error('A file path is required');
    err.statusCode = 400;
    err.status = 400;
    throw err;
  }
  if (trimmed.length > maxLength) {
    const err = new Error(`File path exceeds maximum length of ${maxLength} characters`);
    err.statusCode = 400;
    err.status = 400;
    throw err;
  }
  if (trimmed.includes('\0')) {
    const err = new Error('File path cannot contain null bytes');
    err.statusCode = 400;
    err.status = 400;
    throw err;
  }
  if (/[\x00-\x1f]/.test(trimmed)) {
    const err = new Error('File path cannot contain control characters');
    err.statusCode = 400;
    err.status = 400;
    throw err;
  }
  return trimmed;
}
