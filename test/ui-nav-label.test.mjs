import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('plugin nav label uses the en and zh titles without a locale call', () => {
  const src = readFileSync(new URL('../src/client/entry.js', import.meta.url), 'utf8')
  assert.match(src, /return zh\.title/)
  assert.match(src, /return en\.title/)
  assert.equal(src.includes("label: () => 'Remote Workspace'"), false)
  assert.equal(src.includes('ctx.locale.get('), false)
  assert.equal(src.includes('ctx.locale.t('), false)
  const locales = readFileSync(new URL('../src/client/locales.js', import.meta.url), 'utf8')
  assert.match(locales, /title: 'Remote Workspace'/)
  assert.match(locales, /title: '远程开发工作区'/)
})
