import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SshService } from '../lib/ssh-service.js';

test('keyboard prompt is returned once and expires', async () => {
  const service = new SshService({});
  let finished = null;
  service.beginKeyboardPrompt('host-a', {
    instructions: 'Verification code',
    prompts: [{ prompt: 'OTP:', echo: false }]
  }, (answers) => { finished = answers; }, 40);

  assert.deepEqual(service.listKeyboardPrompts(), [{
    profileId: 'host-a',
    instructions: 'Verification code',
    prompts: [{ prompt: 'OTP:', echo: false }]
  }]);
  assert.equal(service.submitKeyboardPrompt('missing', ['1']), false);
  assert.equal(service.submitKeyboardPrompt('host-a', ['123456']), true);
  assert.deepEqual(finished, ['123456']);
  assert.deepEqual(service.listKeyboardPrompts(), []);

  finished = null;
  service.beginKeyboardPrompt('host-b', { instructions: '', prompts: [] }, (answers) => { finished = answers; }, 30);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.deepEqual(finished, []);
});

test('ssh dial asks ssh2 for keyboard-interactive', () => {
  const src = readFileSync(new URL('../lib/ssh-service.js', import.meta.url), 'utf8');
  assert.match(src, /tryKeyboard: true/);
  assert.match(src, /keyboard-interactive/);
});
