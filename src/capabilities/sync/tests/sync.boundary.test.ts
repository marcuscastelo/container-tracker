import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SYNC_CAPABILITY_ROOT = path.resolve(process.cwd(), 'src/capabilities/sync')
const SOURCE_FILE_SUFFIXES = new Set(['.ts', '.tsx'])

async function listSourceFiles(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const filesByEntry = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name)

      if (entry.isDirectory()) {
        return listSourceFiles(entryPath)
      }

      if (entry.isFile() && SOURCE_FILE_SUFFIXES.has(path.extname(entry.name))) {
        return [entryPath]
      }

      return []
    }),
  )

  return filesByEntry.flat()
}

function extractImportSpecifiers(sourceCode: string): readonly string[] {
  const specifiers: string[] = []
  const fromImportPattern = /from\s+['"]([^'"]+)['"]/g
  const dynamicImportPattern = /import\(\s*['"]([^'"]+)['"]\s*\)/g

  for (const match of sourceCode.matchAll(fromImportPattern)) {
    const specifier = match[1]
    if (specifier) {
      specifiers.push(specifier)
    }
  }

  for (const match of sourceCode.matchAll(dynamicImportPattern)) {
    const specifier = match[1]
    if (specifier) {
      specifiers.push(specifier)
    }
  }

  return specifiers
}

function isForbiddenDomainImport(specifier: string): boolean {
  const normalizedSpecifier = specifier.replaceAll('\\', '/')
  return normalizedSpecifier.startsWith('~/modules/') && normalizedSpecifier.includes('/domain/')
}

describe('sync capability boundary guard', () => {
  it('forbids imports from modules/*/domain within src/capabilities/sync/**', async () => {
    const sourceFiles = await listSourceFiles(SYNC_CAPABILITY_ROOT)
    const violations: string[] = []

    for (const filePath of sourceFiles) {
      const sourceCode = await readFile(filePath, 'utf-8')
      const importSpecifiers = extractImportSpecifiers(sourceCode)

      for (const specifier of importSpecifiers) {
        if (isForbiddenDomainImport(specifier)) {
          const relativePath = path.relative(process.cwd(), filePath)
          violations.push(`${relativePath} -> ${specifier}`)
        }
      }
    }

    expect(violations).toEqual([])
  })
})
