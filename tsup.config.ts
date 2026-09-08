import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/server/index.ts'],
    format: ['esm'],
    outDir: 'lib',
    dts: true,
    clean: true,
    sourcemap: true,
    external: [
      'ssh2',
      '@deepseek-ai/cordis',
      '@deepseek-ai/dsh-host-webserver',
      '@deepseek-ai/dsh-settings',
      '@deepseek-ai/dsh-tools',
      '@deepseek-ai/schemastery'
    ]
  },
  {
    entry: ['src/client/index.tsx'],
    format: ['esm'],
    outDir: 'lib',
    outExtension() {
      return { js: '.client.js' }
    },
    sourcemap: true,
    external: ['react', 'react-dom']
  }
])
