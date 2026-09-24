import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('internal maps stay in git and out of the public package', () => {
  const root = new URL('..', import.meta.url)
  const agents = readFileSync(new URL('AGENTS.md', root), 'utf8')
  const index = readFileSync(new URL('index.md', root), 'utf8')
  assert.match(agents, /@goodandready\/dsh-remote-workspace/)
  assert.match(index, /npm test/)
  const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
  const files = pkg.files.join('\n')
  assert.equal(files.includes('AGENTS.md'), false)
  assert.equal(files.includes('index.md'), false)
  assert.equal(files.includes('docs'), false)
  const publish = readFileSync(new URL('scripts/publish-github.sh', root), 'utf8')
  assert.match(publish, /"AGENTS.md"/)
  assert.match(publish, /"index.md"/)
  assert.match(publish, /"docs"/)
})
