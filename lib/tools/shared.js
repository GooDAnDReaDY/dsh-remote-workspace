import { defineTool } from '@deepseek-ai/dsh-tools';

export { defineTool };
import {
  isWithinWorkspace,
  resolveWorkspacePath as guardResolveWorkspacePath,
  verifyWorkspaceRealpath as guardVerifyWorkspaceRealpath
} from '../path-guard.js';

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

export const genericOutput = {
  schema: { type: 'object', additionalProperties: true },
  render: (_args, value) => [{
    type: 'text',
    text: typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  }]
};
