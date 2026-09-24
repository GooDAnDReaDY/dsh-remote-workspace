import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('updater version falls back to a locale string', () => {
  const src = readFileSync(new URL('../src/client/updater-section.js', import.meta.url), 'utf8')
  const locales = readFileSync(new URL('../src/client/locales.js', import.meta.url), 'utf8')
  assert.equal(src.includes('0.3.1'), false)
  assert.match(src, /updateStatus\?\.currentVersion \? 'v' \+ updateStatus\.currentVersion : t\('versionUnknown'\)/)
  assert.match(locales, /versionUnknown: 'Version unknown'/)
  assert.match(locales, /versionUnknown: '版本未知'/)
})
