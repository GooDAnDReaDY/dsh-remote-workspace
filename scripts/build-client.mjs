import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceFiles = [
  'styles.js',
  'locales.js',
  'env-editor.js',
  'docker.js',
  'terminal.js',
  'file-browser.js',
  'settings-view.js',
  'updater-section.js',
  'plugin-card.js',
  'entry.js',
]

const prefix = `// Remote Workspace Settings Card (settings.plugin.item) & Session Utility Chip.
window.__ModuleLoader__.load({
  id: '@goodandready/dsh-remote-workspace',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const React = require('react')

    const NS = 'dsh-remote-workspace'
    // Plugins page row seat (DSH 0.1.6-alpha.2): key = '<package name>#<row id>'.
    const ROW_ID = 'dsh-remote-workspace'
    const ROW_CONFIG_KEY = '@goodandready/dsh-remote-workspace#' + ROW_ID

`

const suffix = `  },
})
`

const contents = sourceFiles.map((file) => readFileSync(path.join(root, 'src/client', file), 'utf8').trimEnd())
const bundle = prefix + contents.join('\n\n') + '\n\n' + suffix
writeFileSync(path.join(root, 'lib/client.js'), bundle)
console.log(`Built lib/client.js from ${sourceFiles.length} modules (${bundle.length} bytes)`)
