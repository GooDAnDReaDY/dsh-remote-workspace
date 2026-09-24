import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('plugin card badge follows connection state', () => {
  const src = readFileSync(new URL('../src/client/plugin-card.js', import.meta.url), 'utf8')
  assert.equal(src.includes("t('status')"), false)
  assert.match(src, /statusReady/)
  assert.match(src, /statusEmpty/)
  assert.match(src, /statusError/)
  assert.match(src, /statusLoading/)
  const locales = readFileSync(new URL('../src/client/locales.js', import.meta.url), 'utf8')
  assert.match(locales, /statusReady: 'Host ready'/)
  assert.match(locales, /statusReady: '主机已就绪'/)
})
