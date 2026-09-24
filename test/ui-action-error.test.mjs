import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function loadActionErrorText() {
  const src = readFileSync(new URL('../src/client/settings-view.js', import.meta.url), 'utf8')
  const start = src.indexOf('function actionErrorText')
  assert.notEqual(start, -1)
  const end = src.indexOf('\n      }', start)
  const body = src.slice(start, end + '\n      }'.length).replace(/^ {6}/gm, '')
  return new Function(`${body}\nreturn actionErrorText`)()
}

test('action errors surface the server error string', () => {
  const actionErrorText = loadActionErrorText()
  assert.equal(actionErrorText(200, { ok: true }), '')
  assert.equal(actionErrorText(400, { ok: false, error: 'ID and Host are required' }), 'ID and Host are required')
  assert.equal(actionErrorText(500, { ok: false, error: 'settings replace failed' }), 'settings replace failed')
  assert.equal(actionErrorText(403, {}), 'HTTP 403')
})

test('profile actions render an alert instead of swallowing HTTP failures', () => {
  const src = readFileSync(new URL('../src/client/settings-view.js', import.meta.url), 'utf8')
  assert.match(src, /role: 'alert'/)
  assert.match(src, /const data = await reportAction\(res\)/)
  assert.equal(src.includes('handleSave'), true)
})
