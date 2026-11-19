import path from 'node:path';

/**
 * Single source of truth for workspace path guarding (#162).
 *
 * Before this module, `lib/routes/helpers.js` and `lib/tools.js` carried two
 * drifting implementations of the same security logic: they diverged in error
 * texts, statusCode presence and edge-case behaviour (sudo, unresolvable
 * workspace roots). Every consumer now imports from here:
 *
 * - `lib/routes/helpers.js` re-exports the route variant (sudo elevation,
 *   HTTP statusCode on errors, hard failure when the workspace root cannot
 *   be realpath-resolved).
 * - `lib/tools.js` re-exports the tool variant (workspace required,
 *   tolerant fallback when a fresh workspace root is not resolvable yet -
 *   mkdir/write into a new workspace must keep working).
 */

// Bounded diagnostics for swallowed errors inside the guard itself (#160).
const lastErrors = new Map();

function noteError(key, err) {
  lastErrors.set(key, { message: err && err.message ? err.message : String(err), at: Date.now() });
  if (lastErrors.size > 100) {
    const oldest = lastErrors.keys().next().value;
    lastErrors.delete(oldest);
  }
}

function withStatusCode(message, code) {
  const err = new Error(message);
  err.statusCode = code;
  err.status = code;
  return err;
}

export function isWithinWorkspace(normWorkspace, candidatePath) {
  const normCandidate = path.posix.normalize(candidatePath);
  const prefix = normWorkspace.endsWith('/') ? normWorkspace : normWorkspace + '/';
  return normCandidate === normWorkspace || normCandidate.startsWith(prefix);
}

/**
 * Resolve a caller-supplied path against the configured remote workspace.
 *
 * @param {string|null} workspace configured remoteWorkspace of the profile
 * @param {string} targetPath caller-supplied path
 * @param {{ sudo?: boolean, requireWorkspace?: boolean }} [options]
 *   - `sudo` (#131): allow absolute system paths for root elevation.
 *   - `requireWorkspace` (tools): refuse to operate when the profile has no
 *     workspace configured instead of falling back to the raw path.
 */
export function resolveWorkspacePath(workspace, targetPath, options = {}) {
  const { sudo = false, requireWorkspace = false } = options;
  const trimmedTarget = String(targetPath || '').trim();
  if (!trimmedTarget || trimmedTarget.includes('\0')) {
    throw withStatusCode('Path must be a non-empty string without null bytes', 400);
  }

  // If sudo is explicitly requested for root elevation (#131), allow absolute paths
  if (sudo && path.posix.isAbsolute(trimmedTarget)) {
    return path.posix.normalize(trimmedTarget);
  }

  if (!workspace || typeof workspace !== 'string' || !workspace.trim()) {
    if (requireWorkspace) {
      throw new Error('Remote workspace is not configured for active profile');
    }
    return path.posix.normalize(trimmedTarget);
  }

  const trimmedWorkspace = workspace.trim();
  if (trimmedWorkspace.includes('\0') || !path.posix.isAbsolute(trimmedWorkspace)) {
    throw withStatusCode('Remote workspace must be an absolute path starting with "/"', 400);
  }

  const normWorkspace = path.posix.normalize(trimmedWorkspace);
  const resolved = path.posix.isAbsolute(trimmedTarget)
    ? path.posix.normalize(trimmedTarget)
    : path.posix.resolve(normWorkspace, trimmedTarget);

  if (!isWithinWorkspace(normWorkspace, resolved)) {
    throw withStatusCode(
      `Access denied: path "${targetPath}" is outside configured remoteWorkspace "${workspace}"`,
      403
    );
  }
  return resolved;
}

/**
 * Verify that the resolved path (and its real path, if the remote resolves
 * one) stays inside the real workspace directory. Catches symlink escapes.
 *
 * @param {{ sudo?: boolean, workspaceFallback?: boolean }} [options]
 *   - `sudo` (#131): skip verification for root-elevated paths.
 *   - `workspaceFallback` (tools): when the workspace root itself cannot be
 *     realpath-resolved (fresh workspace), fall back to the normalized
 *     configured workspace instead of failing.
 */
export async function verifyWorkspaceRealpath(remoteFs, profile, workspace, resolvedPath, targetPath, options = {}) {
  const { sudo = false, workspaceFallback = false } = options;
  if (sudo) {
    return resolvedPath;
  }
  if (!remoteFs || typeof remoteFs.realpath !== 'function' || !workspace) {
    return resolvedPath;
  }
  const normWorkspace = path.posix.normalize(workspace.trim());
  let realWorkspace = normWorkspace;
  try {
    const resolvedWs = await remoteFs.realpath(profile, normWorkspace);
    if (resolvedWs && typeof resolvedWs === 'string') {
      realWorkspace = path.posix.normalize(resolvedWs);
    }
  } catch (err) {
    if (!workspaceFallback) {
      noteError('lastRealpathErr', err);
      throw withStatusCode(
        `Workspace directory "${workspace}" is not accessible on remote host: ${err && err.message ? err.message : err}`,
        400
      );
    }
    // Fallback to normalized configured workspace if workspace root itself cannot be resolved yet
  }

  let realCandidate = null;
  try {
    realCandidate = await remoteFs.realpath(profile, resolvedPath);
  } catch (err) {
    // For non-existent leaf targets (e.g., write / mkdir), verify the parent directory realpath
    const parentPath = path.posix.dirname(resolvedPath);
    try {
      const realParent = await remoteFs.realpath(profile, parentPath);
      if (realParent && typeof realParent === 'string') {
        realCandidate = path.posix.join(realParent, path.posix.basename(resolvedPath));
      }
    } catch (parentErr) {
      noteError('lastParentRealpathErr', parentErr);
      realCandidate = null;
    }
  }

  if (realCandidate && typeof realCandidate === 'string') {
    const normReal = path.posix.normalize(realCandidate);
    if (!isWithinWorkspace(realWorkspace, normReal)) {
      throw withStatusCode(
        `Access denied: symlink target "${normReal}" for path "${targetPath}" escapes configured remoteWorkspace "${workspace}"`,
        403
      );
    }
    return normReal;
  }
  return resolvedPath;
}

export function validateRemotePath(filePath, options = {}) {
  const { allowEmpty = false, maxLength = 1024, workspace, sudo = false } = options;
  if (!filePath && filePath !== '') {
    if (allowEmpty) return '';
    throw withStatusCode('A file path is required', 400);
  }
  if (typeof filePath !== 'string') {
    throw withStatusCode('File path must be a string', 400);
  }
  const trimmed = filePath.trim();
  if (!trimmed) {
    if (allowEmpty) return '';
    throw withStatusCode('A file path is required', 400);
  }
  if (trimmed.length > maxLength) {
    throw withStatusCode(`File path exceeds maximum length of ${maxLength} characters`, 400);
  }
  if (trimmed.includes('\0')) {
    throw withStatusCode('File path cannot contain null bytes', 400);
  }
  if (/[\x00-\x1f]/.test(trimmed)) {
    throw withStatusCode('File path cannot contain control characters', 400);
  }
  if (workspace) {
    return resolveWorkspacePath(workspace, trimmed, { sudo });
  }
  return trimmed;
}
