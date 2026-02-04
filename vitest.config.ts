import path from 'path'
import { defineConfig } from 'vitest/config'

// biome-ignore lint/style/noDefaultExport: Needed for Vitest config
export default defineConfig({
  resolve: {
    alias: [
      { find: /^~\/(.*)/, replacement: path.resolve(__dirname, 'src/$1') },
      { find: '~', replacement: path.resolve(__dirname, 'src') },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
  },
})
