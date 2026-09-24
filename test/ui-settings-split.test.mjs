import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('settings view composes profile, sync, and tunnel panels', () => {
  const root = new URL('../', import.meta.url)
  const view = readFileSync(new URL('src/client/settings-view.js', root), 'utf8')
  const profiles = readFileSync(new URL('src/client/profiles-panel.js', root), 'utf8')
  const sync = readFileSync(new URL('src/client/sync-panel.js', root), 'utf8')
  const tunnels = readFileSync(new URL('src/client/tunnels-panel.js', root), 'utf8')
  const build = readFileSync(new URL('scripts/build-client.mjs', root), 'utf8')
  assert.ok(view.split('\n').length <= 600, 'settings-view stays within 600 lines')
  assert.match(view, /ProfilesPanel/)
  assert.match(view, /SyncPanel/)
  assert.match(view, /TunnelsPanel/)
  assert.match(view, /profiles\/save/)
  assert.match(profiles, /function ProfilesPanel/)
  assert.match(profiles, /profilesTitle/)
  assert.match(sync, /function SyncPanel/)
  assert.match(sync, /handleSync\('pull'\)/)
  assert.match(tunnels, /function TunnelsPanel/)
  assert.match(tunnels, /tunnels\/start|handleStartTunnel/)
  assert.match(build, /profiles-panel\.js/)
  assert.match(build, /sync-panel\.js/)
  assert.match(build, /tunnels-panel\.js/)
  for (const name of ['terminal.js', 'docker.js', 'file-browser.js']) {
    assert.match(build, new RegExp(name.replace('.', '\\.')))
  }
})
