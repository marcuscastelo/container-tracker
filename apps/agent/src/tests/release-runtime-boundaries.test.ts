import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function listTypeScriptFiles(rootDir: string): readonly string[] {
  const files: string[] = []
  const stack: string[] = [rootDir]

  while (stack.length > 0) {
    const currentDir = stack.pop()
    if (!currentDir) {
      continue
    }

    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
        continue
      }

      if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        files.push(fullPath)
      }
    }
  }

  return files
}

function toRelativeFromAgentSrc(filePath: string): string {
  return path.relative(path.join(process.cwd(), 'apps', 'agent', 'src'), filePath)
}

describe('release/runtime boundaries', () => {
  it('runtime does not import release download/checksum/extract internals', () => {
    const runtimeRoot = path.join(process.cwd(), 'apps', 'agent', 'src', 'runtime')
    const runtimeFiles = listTypeScriptFiles(runtimeRoot)

    const forbiddenPatterns = [
      '@agent/release/infrastructure/bundle-downloader',
      '@agent/release/infrastructure/bundle-extractor',
      '@agent/release/infrastructure/release-manifest.client',
      '@agent/release/application/verify-release-checksum',
    ]

    const violations = runtimeFiles.flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8')
      return forbiddenPatterns
        .filter((pattern) => source.includes(pattern))
        .map((pattern) => `${toRelativeFromAgentSrc(filePath)} imports ${pattern}`)
    })

    expect(violations).toEqual([])
  })

  it('release does not import sync/provider execution modules', () => {
    const releaseRoot = path.join(process.cwd(), 'apps', 'agent', 'src', 'release')
    const releaseFiles = listTypeScriptFiles(releaseRoot)

    const forbiddenPatterns = [
      '@agent/sync/',
      '/tracking/infrastructure/carriers/fetchers/',
      '@supabase/supabase-js',
      'subscribeSyncRequestsByTenant',
    ]

    const violations = releaseFiles.flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8')
      return forbiddenPatterns
        .filter((pattern) => source.includes(pattern))
        .map((pattern) => `${toRelativeFromAgentSrc(filePath)} imports ${pattern}`)
    })

    expect(violations).toEqual([])
  })
})
