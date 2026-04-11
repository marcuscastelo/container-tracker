import fs from 'node:fs'
import path from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'

const coverageScopePath = path.resolve(__dirname, 'docs/plans/coverage-scope.json')
const coverageScope = JSON.parse(fs.readFileSync(coverageScopePath, 'utf8'))

// biome-ignore lint/style/noDefaultExport: Needed for Vitest config
export default defineConfig({
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

        let after = ''
        let roots: readonly string[] = []

        if (source.startsWith('~')) {
          after = source.startsWith('~/') ? source.slice(2) : source.slice(1)
          roots = ['src']
        } else if (source.startsWith('@tools/')) {
          after = source.slice('@tools/'.length)
          roots = ['tools']
        } else {
          return null
        }

        const tryPaths = roots.map((root) => path.resolve(__dirname, root, after))

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
    // Playwright specs run via `pnpm test:playwright`, not Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**', 'packaging/arch/src/**'],
    coverage: {
      provider: 'v8',
      all: true,
      reportOnFailure: true,
      reportsDirectory: 'coverage/vitest',
      include: coverageScope.coverage.include,
      exclude: coverageScope.coverage.exclude,
      reporter: ['text-summary', 'json-summary', 'json', 'lcovonly', 'html'],
    },
  },
})
