import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('card chevron uses the shared icon and keeps the fallback', () => {
  const card = readFileSync(new URL('../src/client/plugin-card.js', import.meta.url), 'utf8')
  const locales = readFileSync(new URL('../src/client/locales.js', import.meta.url), 'utf8')
  assert.match(card, /ChevronIcon \|\| FallbackChevron/)
  assert.match(card, /aria-expanded/)
  assert.equal(card.includes('React.createElement(FallbackChevron)'), false)
  assert.match(locales, /IconChevronDownOutline14/)
  assert.match(locales, /function FallbackChevron/)
})
