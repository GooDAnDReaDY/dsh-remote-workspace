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

export function isTrustedSettingsRequest(req) {
  const ip = req?.socket?.remoteAddress || '';
  const isLoopback = isLoopbackAddress(ip);

  const secFetch = req?.headers?.['sec-fetch-site'];
  // Fail-closed: unconditionally reject cross-site and cross-origin requests
  if (secFetch && secFetch !== 'same-origin') {
    return false;
  }

  // If origin is present, ensure it matches the request host
  const origin = req?.headers?.['origin'];
  const host = req?.headers?.['host'];
  if (origin && host) {
    try {
      const url = new URL(origin);
      if (url.host !== host) {
        return false;
      }
    } catch {
      return false;
    }
  }

  const rawAuth = req?.headers?.['authorization'];
  const cookieHeader = req?.headers?.['cookie'];
  const expectedToken = process.env.DSH_AUTH_TOKEN || process.env.DSH_TOKEN;

  if (expectedToken) {
    if (typeof rawAuth === 'string' && rawAuth.startsWith('Bearer ')) {
      const token = rawAuth.slice(7).trim();
      if (token && token === expectedToken) return true;
    }
    if (typeof cookieHeader === 'string') {
      const cookies = parseCookies(cookieHeader);
      const token = cookies['token'] || cookies['dsh_token'];
      if (token && token === expectedToken) return true;
    }
    return false;
  }

  // Non-loopback requests without valid token must not pass simply on Sec-Fetch-Site: same-origin
  if (!isLoopback) return false;
  if (secFetch === 'same-origin') return true;
  return true;
}

export function getConnection(ctx) {
  try {
    return ctx?.reflect?.get ? ctx.reflect.get('connection') : (ctx?.get ? ctx.get('connection') : Reflect.get(ctx || {}, 'connection'));
  } catch {
    return undefined;
  }
}

export function authorizeRequest(sctx, req, res) {
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
