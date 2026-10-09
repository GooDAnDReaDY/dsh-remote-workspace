import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Theme Tokens [Fixes #108]: client bundle contains zero non-canonical theme tokens and has error fallback', () => {
  const clientPath = path.resolve('lib/client.js');
  const content = fs.readFileSync(clientPath, 'utf8');

  const forbiddenTokens = [
    '--dsw-alias-bg-layer-4',
    '--dsw-alias-link-primary',
    '--dsw-alias-state-brand-primary',
    '--dsw-alias-state-error-bg',
    '--dsw-alias-state-error-border',
    '--dsw-alias-state-error-text',
    '--dsw-alias-state-success-bg',
    '--dsw-alias-state-success-text',
    '--dsw-alias-state-warning-bg',
    '--dsw-alias-state-warning-border',
    '--dsw-alias-state-warning-primary',
    '--dsw-alias-state-warning-text',
    '--dsw-alias-mask'
  ];

  for (const token of forbiddenTokens) {
    const re = new RegExp(token + '([^a-zA-Z0-9_-]|$)');
    assert.equal(re.test(content), false, `Client bundle must not use non-canonical token ${token}`);
  }

  // Canonical replacements must be present
  assert.ok(content.includes('--dsw-alias-state-error-primary'), 'Must use state-error-primary');
  assert.ok(content.includes('--dsw-alias-state-warn-primary'), 'Must use state-warn-primary');
  assert.ok(content.includes('--dsw-alias-bg-layer-3'), 'Must use bg-layer-3');
  assert.ok(content.includes('--dsw-alias-link'), 'Must use link token');
  assert.ok(content.includes('--dsw-alias-brand-primary'), 'Must use brand-primary token');
  assert.ok(content.includes('--dsw-alias-bg-mask-1'), 'Must use bg-mask-1 token');

  // Status message error text must provide fallback
  assert.ok(content.includes('var(--dsw-alias-state-error-primary, #ef4444)'), 'Error text must provide explicit fallback');
});
