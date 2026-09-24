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

export function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function isTrustedSettingsRequest(req) {
  const secFetch = req.headers['sec-fetch-site'];
  // Fail-closed: unconditionally reject cross-site and cross-origin requests
  if (secFetch && secFetch !== 'same-origin') {
    return false;
  }

  // If origin is present, ensure it matches the request host
  const origin = req.headers['origin'];
  const host = req.headers['host'];
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

  const rawAuth = req.headers['authorization'];
  if (typeof rawAuth === 'string' && rawAuth.startsWith('Bearer ')) return true;
  const cookieHeader = req.headers['cookie'];
  if (typeof cookieHeader === 'string' && (cookieHeader.includes('token=') || cookieHeader.includes('dsh_token='))) {
    return true;
  }
  if (secFetch === 'same-origin') return true;
  const ip = req.socket?.remoteAddress || '';
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true;
  return false;
}
