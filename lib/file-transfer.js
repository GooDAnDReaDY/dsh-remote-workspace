const MAX_BYTES = 512 * 1024 * 1024;

export function transferPercent(loaded, total) {
  const done = Number(loaded) || 0;
  const size = Number(total) || 0;
  if (size <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((done / size) * 100)));
}

export function attachmentName(filePath) {
  const base = String(filePath || '').split('/').filter(Boolean).pop() || 'download';
  const clean = base.replace(/[\r\n"\\]/g, '');
  if (!clean || clean === '.' || clean === '..') return 'download';
  return clean.slice(0, 180);
}

export function contentDisposition(filePath) {
  const name = attachmentName(filePath);
  const ascii = name.replace(/[^\x20-\x7E]/g, '_') || 'download';
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export function pipeWithProgress(source, dest) {
  return new Promise((resolve, reject) => {
    let loaded = 0;
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(loaded);
    };
    source.on('data', (chunk) => {
      loaded += chunk.length;
      if (loaded > MAX_BYTES) {
        const err = new Error('File exceeds the 512MB transfer limit');
        err.code = 'LIMIT';
        source.destroy();
        dest.destroy();
        finish(err);
      }
    });
    source.on('error', finish);
    dest.on('error', finish);
    dest.on('finish', () => finish());
    source.on('aborted', () => {
      const err = new Error('Transfer aborted');
      err.code = 'ABORTED';
      dest.destroy();
      finish(err);
    });
    source.pipe(dest);
  });
}

export { MAX_BYTES };
