import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTerminalFont } from '../lib/terminal-font.js';

test('terminal font keeps a safe family and rejects css injection', () => {
  assert.equal(normalizeTerminalFont(''), '');
  assert.equal(normalizeTerminalFont('  Consolas, monospace  '), 'Consolas, monospace');
  assert.throws(() => normalizeTerminalFont('monospace; color: red'), /unsupported/);
  assert.throws(() => normalizeTerminalFont('url(https://evil)'), /unsupported/);
});
