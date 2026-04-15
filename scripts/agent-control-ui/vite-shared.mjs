import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(currentDir, '../..')

function createAgentControlUiViteConfig() {
  return defineConfig({
    root: path.join(repoRoot, 'apps', 'agent', 'src', 'electron', 'renderer'),
    plugins: [solid()],
    publicDir: false,
    base: './',
    resolve: {
      alias: {
        '@agent': path.join(repoRoot, 'apps', 'agent', 'src'),
        '~': path.join(repoRoot, 'src'),
      },
    },
    build: {
      outDir: path.join(
        repoRoot,
        'dist',
        'apps',
        'agent',
        'control-ui',
        'apps',
        'agent',
        'src',
        'electron',
        'renderer',
      ),
      emptyOutDir: false,
      sourcemap: true,
    },
    server: {
      host: '127.0.0.1',
      port: 4310,
      strictPort: true,
    },
  })
}

export { createAgentControlUiViteConfig }
