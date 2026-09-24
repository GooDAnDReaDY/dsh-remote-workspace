import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SshConfigParser } from '../lib/ssh-config-parser.js';

test('parseReport expands Include and explains skipped blocks', () => {
  const report = SshConfigParser.parseReport(`
Include extra.conf
Host good
  HostName 10.0.0.1
Host *
  User nobody
Match host *.internal
  User ops
Host good
  HostName 10.0.0.2
`, {
    expandInclude: () => ['extra.conf'],
    readFile: () => 'Host included\n  HostName 10.1.1.1\n  User dev\n'
  });
  assert.deepEqual(report.profiles.map((item) => item.name), ['included', 'good']);
  assert.equal(report.profiles[0].host, '10.1.1.1');
  assert.deepEqual(report.skipped.map((item) => item.reason), ['wildcard', 'match', 'duplicate']);
});

test('parseReport reads a glob Include from disk', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-ssh-include-'));
  try {
    fs.writeFileSync(path.join(dir, 'alpha.conf'), 'Host alpha\n  HostName 10.0.0.8\n');
    const report = SshConfigParser.parseReport('Include *.conf\n', { baseDir: dir });
    assert.equal(report.profiles[0].name, 'alpha');
    assert.equal(report.profiles[0].host, '10.0.0.8');
    assert.deepEqual(report.skipped, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('parse still returns the profile array', () => {
  const profiles = SshConfigParser.parse('Host web\n  HostName web.example\n');
  assert.equal(profiles[0].host, 'web.example');
});
