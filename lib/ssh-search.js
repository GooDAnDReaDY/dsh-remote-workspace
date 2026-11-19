/**
 * Workspace code search over an SSH exec channel (#173): extracted from
 * SshService so the connection service stays under the size budget.
 * @param {{ exec: Function }} ssh
 */
export async function searchCodebase(ssh, profile, options = {}) {
  if (!profile) throw new Error('Profile is required');
  const {
    query,
    isRegex = false,
    path: searchPath = profile.remoteWorkspace,
    maxResults = 50,
    filePattern = null,
  } = options;

  if (!query || typeof query !== 'string') {
    throw new Error('Search query is required');
  }

  const escapedQuery = query.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
  const escapedPath = (searchPath || '.').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const rgPatternArg = filePattern ? `--glob "${filePattern.replace(/"/g, '\\"')}"` : '';
  const grepPatternArg = filePattern ? `--include="${filePattern.replace(/"/g, '\\"')}"` : '';

  const rgRegexFlag = isRegex ? '' : '-F';
  const grepRegexFlag = isRegex ? '-E' : '-F';

  const shellScript = `
if command -v rg >/dev/null 2>&1; then
  rg ${rgRegexFlag} --line-number --no-heading --color=never --hidden \\
    --glob '!.git' --glob '!node_modules' --glob '!dist' --glob '!build' --glob '!vendor' --glob '!__pycache__' --glob '!.next' --glob '!coverage' \\
    ${rgPatternArg} --max-count ${maxResults + 1} "${escapedQuery}" "${escapedPath}" 2>/dev/null || true
else
  grep -rnI ${grepRegexFlag} \\
    --exclude-dir={.git,node_modules,dist,build,vendor,__pycache__,.next,coverage} \\
    ${grepPatternArg} "${escapedQuery}" "${escapedPath}" 2>/dev/null | head -n ${maxResults + 1} || true
fi
`.trim();

  const execRes = await ssh.exec(profile, shellScript, {
    cwd: searchPath || profile.remoteWorkspace,
    timeout: 15,
    maxBufferSize: 128 * 1024,
  });

  const lines = (execRes.stdout || '').split(/\r?\n/).filter(line => line.trim().length > 0);
  const matches = [];
  const normBase = searchPath && searchPath.endsWith('/') ? searchPath : `${searchPath}/`;

  for (const line of lines) {
    if (matches.length >= maxResults) break;
    const firstColon = line.indexOf(':');
    if (firstColon === -1) continue;
    const secondColon = line.indexOf(':', firstColon + 1);
    if (secondColon === -1) continue;

    const rawFile = line.slice(0, firstColon);
    const lineNumStr = line.slice(firstColon + 1, secondColon);
    const text = line.slice(secondColon + 1);

    const lineNum = parseInt(lineNumStr, 10);
    if (isNaN(lineNum)) continue;

    let relFile = rawFile;
    if (normBase && rawFile.startsWith(normBase)) {
      relFile = rawFile.slice(normBase.length);
    } else if (searchPath && rawFile.startsWith(searchPath)) {
      relFile = rawFile.slice(searchPath.length).replace(/^\/+/, '');
    }

    matches.push({
      file: relFile,
      line: lineNum,
      text: text.trimEnd(),
    });
  }

  return {
    query,
    path: searchPath,
    matches,
    totalMatches: matches.length,
    truncated: lines.length > maxResults,
  };
}
