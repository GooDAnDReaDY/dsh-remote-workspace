import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';

export function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

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

// Module-level diagnostics for swallowed errors (#160). The package is an ES
// module, so `this` is undefined inside plain functions — the previous
// `this.lastXxx = err` assignments threw TypeError and masked the original
// failure with a 500.
const lastErrors = new Map();

function noteError(key, err) {
  lastErrors.set(key, { message: err && err.message ? err.message : String(err), at: Date.now() });
  if (lastErrors.size > 100) {
    const oldest = lastErrors.keys().next().value;
    lastErrors.delete(oldest);
  }
}

// Shared by sibling route modules so their swallowed errors land in the same
// diagnostics map instead of the (undefined) `this`.
export function noteRouteError(key, err) {
  noteError(key, err);
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
    } catch (e) {
      noteError('lastOriginErr', e);
      return false;
    }
  }

  const tokenCandidate = (typeof expectedToken === 'string' && expectedToken)
    || process.env.DSH_AUTH_TOKEN
    || process.env.DSH_TOKEN
    || null;

  // Credentials presented on the request must match the configured token.
  const rawAuth = headers['authorization'];
  const bearer = typeof rawAuth === 'string' && rawAuth.startsWith('Bearer ')
    ? rawAuth.slice(7).trim()
    : null;
  let cookieToken = null;
  const cookieHeader = headers['cookie'];
  if (typeof cookieHeader === 'string') {
    const cookies = parseCookies(cookieHeader);
    cookieToken = cookies['token'] || cookies['dsh_token'] || null;
  }
  if (bearer || cookieToken) {
    if (tokenCandidate) {
      if (bearer && timingSafeCompare(bearer, tokenCandidate)) return true;
      if (cookieToken && timingSafeCompare(cookieToken, tokenCandidate)) return true;
      return false; // wrong credentials are never accepted
    }
    // No expected token configured: presented credentials carry no meaning,
    // fall through to the trust checks below.
  }

  const ip = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  const hasRemote = Boolean(ip && typeof ip === 'string');
  const isLoopback = hasRemote && isLoopbackAddress(ip);

  // #165: DSH_AUTH_TOKEN exists to authenticate external API callers. It must
  // not reject the legitimate same-origin browser session (the DSH core owns
  // that decision through connection.requestRejection) or the plugin's own
  // loopback callers.
  if (tokenCandidate) {
    if (secFetch === 'same-origin') {
      return true;
    }
    if (isLoopback) {
      return true;
    }
    return false; // external caller without valid credentials
  }

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
  } catch (e) {
    noteError('lastConnErr', e);
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
  } catch (e) {
    noteError('lastAuthConnErr', e);
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
  } catch (e) {
    noteError('lastRejectionErr', e);
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

// #162: the workspace path-guard lives in a single module shared with lib/tools.js.
// This re-export keeps the route import surface unchanged.
export {
  isWithinWorkspace,
  resolveWorkspacePath,
  verifyWorkspaceRealpath,
  validateRemotePath
} from '../path-guard.js';
