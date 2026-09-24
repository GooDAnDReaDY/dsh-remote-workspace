const FONT_PATTERN = /^[A-Za-z0-9 ,."'_-]{1,80}$/;

export function normalizeTerminalFont(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (!FONT_PATTERN.test(text)) {
    const err = new Error('Terminal font contains unsupported characters');
    err.code = 'INVALID_FONT';
    throw err;
  }
  return text;
}
