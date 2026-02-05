import fs from 'fs'
import path from 'path'
import { defineConfig } from 'vitest/config'

// biome-ignore lint/style/noDefaultExport: Needed for Vitest config
export default defineConfig({
  // Use a resolve plugin so we can dynamically prefer files under `marucs-src/`
  // when present, but fall back to `src/` for files that only live there.
  plugins: [
    {
      name: 'alias-tilde-fallback',
      async resolveId(source) {
        // Special-case a few packages that cause client-only code to run during
        // server-side tests. Prefer our test stubs when present.
        if (source === 'solid-toast' || source.startsWith('solid-toast/')) {
          const stub = path.resolve(__dirname, 'test-stubs/solid-toast.mjs')
          if (fs.existsSync(stub)) return stub
        }

        if (!source.startsWith('~')) return null

        // Normalize import path after the tilde
        const after = source.startsWith('~/') ? source.slice(2) : source.slice(1)

        const tryPaths = [
          path.resolve(__dirname, 'marucs-src', after),
          path.resolve(__dirname, 'src', after),
        ]

        const exts = [
          '.ts',
          '.tsx',
          '.js',
          '.jsx',
          '.mjs',
          '.cjs',
          '/index.ts',
          '/index.tsx',
          '/index.js',
          '',
        ]

        for (const base of tryPaths) {
          for (const ext of exts) {
            const candidate = base + ext
            try {
              if (fs.existsSync(candidate)) return candidate
            } catch {
              // ignore
            }
          }
        }

        return null
      },
    },
  ],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [path.resolve(__dirname, 'vitest.setup.ts')],
  },
})
