import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('npm files omit internal docs', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const files = pkg.files || []
  assert.equal(files.some((item) => item === 'docs' || item.startsWith('docs/')), false)
  for (const name of ['README.md', 'README.ru.md', 'README.zh.md', 'LICENSE']) {
    assert.equal(files.includes(name), true)
  }
})

test('GitHub publish script forbids docs', () => {
  const src = readFileSync(new URL('../scripts/publish-github.sh', import.meta.url), 'utf8')
  assert.match(src, /"docs"/)
})
