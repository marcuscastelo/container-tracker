import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(currentDir, '../..')

function createAgentControlUiViteConfig() {
  return defineConfig({
    root: path.join(repoRoot, 'tools', 'agent-control-ui', 'renderer'),
    plugins: [solid()],
    publicDir: false,
    base: './',
    resolve: {
      alias: {
        '@tools': path.join(repoRoot, 'tools'),
        '~': path.join(repoRoot, 'src'),
      },
    },
    build: {
      outDir: path.join(
        repoRoot,
        'dist',
        'agent-control-ui',
        'tools',
        'agent-control-ui',
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
