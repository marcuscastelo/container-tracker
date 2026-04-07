import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@solidjs/start/config'
import tailwindcss from '@tailwindcss/vite'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  ssr: false,
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '~': path.join(currentDir, 'src'),
        '@tools': path.join(currentDir, 'tools'),
      },
    },
  },
})
