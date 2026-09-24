import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

test('tarball names are ignored without surrounding spaces', () => {
  const text = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8')
  const lines = text.split(/\r?\n/)
  assert.equal(lines.includes('*.tgz'), true)
  assert.equal(lines.includes(' *.tgz '), false)
  const check = spawnSync('git', ['check-ignore', '-v', '--', 'goodandready-dsh-remote-workspace-0.3.7.tgz'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  })
  assert.equal(check.status, 0)
  assert.match(check.stdout, /\.gitignore:.*\*\.tgz/)
})
