import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('UI test connection posts the profile fields at the top level', () => {
  const src = readFileSync(new URL('../src/client/settings-view.js', import.meta.url), 'utf8')
  const start = src.indexOf("fetch('/dsh-remote-workspace/test'")
  assert.notEqual(start, -1)
  const slice = src.slice(start, start + 280)
  assert.match(slice, /JSON\.stringify\(prof\)/)
  assert.equal(slice.includes('profile: prof'), false)
})
