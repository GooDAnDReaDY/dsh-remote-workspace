export class GitService {
  constructor(sshService) {
    this.sshService = sshService;
  }

  async getStatus(profile, repoPath = null) {
    if (!profile) throw new Error('Profile is required');
    const targetPath = repoPath || profile.remoteWorkspace;
    if (!targetPath) throw new Error('Repository path is required');

    // 1. Verify inside git work tree
    const checkRepo = await this.sshService.exec(
      profile,
      'git rev-parse --is-inside-work-tree 2>/dev/null || echo "NOT_GIT"',
      targetPath
    );

    if (checkRepo.stdout.includes('NOT_GIT') || checkRepo.code !== 0) {
      return {
        isRepo: false,
        path: targetPath,
        branch: null,
        dirtyCount: 0,
        files: []
      };
    }

    // 2. Current branch
    const branchRes = await this.sshService.exec(
      profile,
      'git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "HEAD"',
      targetPath
    );
    const branch = branchRes.stdout.trim() || 'HEAD';

    // 3. Porcelain status
    const statusRes = await this.sshService.exec(
      profile,
      'git status --porcelain=v1 -u 2>/dev/null || true',
      targetPath
    );

    const files = [];
    if (statusRes.stdout) {
      const lines = statusRes.stdout.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        const indexStatus = line[0];
        const worktreeStatus = line[1];
        let filePath = line.slice(3).trim();
        if (filePath.includes(' -> ')) {
          filePath = filePath.split(' -> ')[1].trim();
        }

        let badge = 'M';
        if (indexStatus === '?' || worktreeStatus === '?') {
          badge = '?';
        } else if (indexStatus === 'A' || worktreeStatus === 'A') {
          badge = 'A';
        } else if (indexStatus === 'D' || worktreeStatus === 'D') {
          badge = 'D';
        } else if (indexStatus === 'R' || worktreeStatus === 'R') {
          badge = 'R';
        } else {
          badge = 'M';
        }

        files.push({
          path: filePath,
          indexStatus,
          worktreeStatus,
          badge
        });
      }
    }

    return {
      isRepo: true,
      path: targetPath,
      branch,
      dirtyCount: files.length,
      files
    };
  }
}
