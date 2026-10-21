export function applySearchReplace(originalContent, targetContent, replacementContent = '') {
  if (typeof originalContent !== 'string') {
    throw new Error('Original content must be a string');
  }
  if (!targetContent || typeof targetContent !== 'string') {
    throw new Error('targetContent must be a non-empty string');
  }

  // Count occurrences
  let count = 0;
  let pos = originalContent.indexOf(targetContent);
  while (pos !== -1) {
    count++;
    pos = originalContent.indexOf(targetContent, pos + targetContent.length);
  }

  if (count === 0) {
    throw new Error('Target content not found in file');
  }
  if (count > 1) {
    throw new Error(`Target content matches multiple locations in file (${count} occurrences). Provide more surrounding context.`);
  }

  const newContent = originalContent.replace(targetContent, replacementContent);
  const replacedLines = replacementContent.split('\n').length;

  return {
    newContent,
    patchedLines: replacedLines,
  };
}

export function applyUnifiedDiff(originalContent, patchText) {
  if (typeof originalContent !== 'string') {
    throw new Error('Original content must be a string');
  }
  if (!patchText || typeof patchText !== 'string') {
    throw new Error('Patch text must be a non-empty string');
  }

  const origLines = originalContent.split(/\r?\n/);
  const patchLines = patchText.split(/\r?\n/);

  let hunkRegex = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
  let origIdx = 0;
  let resultLines = [];
  let inHunk = false;
  let patchedCount = 0;

  for (let i = 0; i < patchLines.length; i++) {
    const line = patchLines[i];
    const match = line.match(hunkRegex);
    if (match) {
      const oldStart = parseInt(match[1], 10) - 1;
      while (origIdx < oldStart && origIdx < origLines.length) {
        resultLines.push(origLines[origIdx++]);
      }
      inHunk = true;
      continue;
    }

    if (!inHunk) continue;

    if (line.startsWith('+')) {
      resultLines.push(line.slice(1));
      patchedCount++;
    } else if (line.startsWith('-')) {
      const expected = line.slice(1);
      if (origLines[origIdx] !== expected) {
        throw new Error(`Hunk failed to apply at line ${origIdx + 1}: expected "${expected}", got "${origLines[origIdx]}"`);
      }
      origIdx++;
      patchedCount++;
    } else if (line.startsWith(' ')) {
      const expected = line.slice(1);
      if (origLines[origIdx] !== expected) {
        throw new Error(`Hunk context failed to match at line ${origIdx + 1}: expected "${expected}", got "${origLines[origIdx]}"`);
      }
      resultLines.push(origLines[origIdx++]);
    }
  }

  while (origIdx < origLines.length) {
    resultLines.push(origLines[origIdx++]);
  }

  return {
    newContent: resultLines.join('\n'),
    patchedLines: patchedCount,
  };
}

export async function patchFile(profile, remoteFs, resolvedPath, options = {}) {
  if (!profile) throw new Error('Profile is required');
  if (!remoteFs) throw new Error('remoteFs is required');
  if (!resolvedPath || typeof resolvedPath !== 'string') {
    throw new Error('Valid resolvedPath is required');
  }

  const stat = await remoteFs.stat(profile, resolvedPath);
  if (!stat || stat.isDirectory) {
    const err = new Error(`Cannot patch: "${resolvedPath}" is a directory or not found`);
    err.statusCode = 400;
    throw err;
  }

  const originalBuf = await remoteFs.readFile(profile, resolvedPath);
  const originalContent = typeof originalBuf === 'string' ? originalBuf : originalBuf.toString('utf8');

  let patchResult;
  if (options.targetContent !== undefined) {
    patchResult = applySearchReplace(originalContent, options.targetContent, options.replacementContent || '');
  } else if (options.patch) {
    patchResult = applyUnifiedDiff(originalContent, options.patch);
  } else {
    const err = new Error('Either (targetContent, replacementContent) or patch string is required');
    err.statusCode = 400;
    throw err;
  }

  // Create automated backup copy
  const backupPath = resolvedPath + '.bak';
  await remoteFs.writeFile(profile, backupPath, originalContent);

  // Write patched file
  await remoteFs.writeFile(profile, resolvedPath, patchResult.newContent);

  return {
    ok: true,
    path: resolvedPath,
    backupPath,
    patchedLines: patchResult.patchedLines,
  };
}
