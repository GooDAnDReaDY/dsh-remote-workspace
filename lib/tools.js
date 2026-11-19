import {
  isWithinWorkspace,
  resolveWorkspacePath as guardResolveWorkspacePath,
  verifyWorkspaceRealpath as guardVerifyWorkspaceRealpath
} from './path-guard.js';
import { genericOutput } from './tools/shared.js';
import { register as registerExecTools } from './tools/exec-tools.js';
import { register as registerTunnelTools } from './tools/tunnel-tools.js';
import { register as registerGitTools } from './tools/git-tools.js';
import { register as registerFsTools } from './tools/fs-tools.js';
import { register as registerSyncTools } from './tools/sync-tools.js';
import { register as registerDockerTools } from './tools/docker-tools.js';
import { register as registerDiagnoseTools } from './tools/diagnose-tools.js';
import { register as registerEnvTools } from './tools/env-tools.js';
import { register as registerHostTools } from './tools/host-tools.js';

// #162: single shared path-guard. Tool call sites keep their stricter
// behaviour: a workspace must be configured, and a not-yet-resolvable
// workspace root (fresh workspace, mkdir/write targets) falls back to the
// normalized configured path instead of failing.
export { isWithinWorkspace };

export function resolveWorkspacePath(workspace, targetPath) {
  return guardResolveWorkspacePath(workspace, targetPath, { requireWorkspace: true });
}

export function verifyWorkspaceRealpath(remoteFs, profile, workspace, resolvedPath, targetPath) {
  return guardVerifyWorkspaceRealpath(remoteFs, profile, workspace, resolvedPath, targetPath, { workspaceFallback: true });
}

export function registerRemoteTools(ctx, sshService, remoteFs, mirrorSync, tunnelService, getActiveProfile, getProfileById, dockerService, diagnoseService, envService, tarSyncService, listProfiles = null, gitService = null, bootstrapService = null) {
  if (!ctx.tools || typeof ctx.tools.register !== 'function') {
    return;
  }

  // #173: the tool surface lives in lib/tools/* domain modules; this facade
  // only wires the dependency bundle in the original registration order.
  const deps = {
    ctx,
    sshService,
    remoteFs,
    mirrorSync,
    tunnelService,
    getActiveProfile,
    getProfileById,
    dockerService,
    diagnoseService,
    envService,
    tarSyncService,
    listProfiles,
    gitService,
    bootstrapService,
    genericOutput,
    resolveWorkspacePath,
    verifyWorkspaceRealpath
  };

  registerExecTools(deps);
  registerTunnelTools(deps);
  registerGitTools(deps);
  registerFsTools(deps);
  registerSyncTools(deps);
  registerDockerTools(deps);
  registerDiagnoseTools(deps);
  registerEnvTools(deps);
  registerHostTools(deps);
}
