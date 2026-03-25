#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const rootDir = process.cwd()
const srcDir = path.join(rootDir, 'src')

const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.cts'])

/**
 * @typedef {{
 *   readonly file: string
 *   readonly rule: string
 *   readonly message: string
 *   readonly line: number | null
 * }} Violation
 */

/** @type {Violation[]} */
const violations = []

function toPosix(filePath) {
  return filePath.split(path.sep).join('/')
}

function isSourceFile(filePath) {
  return sourceExtensions.has(path.extname(filePath))
}

function isTestFile(relativePath) {
  return (
    relativePath.includes('/tests/') ||
    relativePath.includes('/__tests__/') ||
    /\.test\.[mc]?[jt]sx?$/.test(relativePath) ||
    /\.spec\.[mc]?[jt]sx?$/.test(relativePath)
  )
}

async function walkFiles(currentPath) {
  const entries = await fs.readdir(currentPath, { withFileTypes: true })
  /** @type {string[]} */
  const files = []

  for (const entry of entries) {
    const absolute = path.join(currentPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(absolute)))
      continue
    }

    if (entry.isFile() && isSourceFile(absolute)) {
      files.push(absolute)
    }
  }

  return files
}

function getLineNumber(content, index) {
  if (index < 0) return null
  let line = 1
  for (let i = 0; i < index; i++) {
    if (content[i] === '\n') line += 1
  }
  return line
}

function addViolation(file, rule, message, line) {
  violations.push({
    file,
    rule,
    message,
    line,
  })
}

function extractImports(content) {
  const results = []
  const importRegex = /(?:^|\n)\s*import(?:[\s\S]*?\sfrom\s*)?['"]([^'"]+)['"]/g
  for (;;) {
    const match = importRegex.exec(content)
    if (match === null) break
    const source = match[1]
    const line = getLineNumber(content, match.index)
    results.push({ source, line })
  }
  return results
}

function isUiFile(relativePath) {
  return (
    /src\/modules\/[^/]+\/ui\//.test(relativePath) ||
    /src\/capabilities\/[^/]+\/ui\//.test(relativePath) ||
    relativePath.startsWith('src/shared/ui/')
  )
}

function scanImports(relativePath, content) {
  const imports = extractImports(content)
  const inDomainLayer = /src\/modules\/[^/]+\/domain\//.test(relativePath)
  const inCapabilityLayer = relativePath.startsWith('src/capabilities/')
  const inUiLayer = isUiFile(relativePath)
  const testFile = isTestFile(relativePath)

  for (const entry of imports) {
    const source = entry.source
    const line = entry.line

    if (inDomainLayer && !testFile) {
      if (/^~\/modules\/[^/]+\/application\//.test(source)) {
        addViolation(
          relativePath,
          'domain-import-application',
          `Domain layer must not import application layer: ${source}`,
          line,
        )
      }
      if (/^~\/modules\/[^/]+\/infrastructure\//.test(source)) {
        addViolation(
          relativePath,
          'domain-import-infrastructure',
          `Domain layer must not import infrastructure layer: ${source}`,
          line,
        )
      }
      if (/^~\/modules\/[^/]+\/interface\//.test(source)) {
        addViolation(
          relativePath,
          'domain-import-interface',
          `Domain layer must not import interface layer: ${source}`,
          line,
        )
      }
      if (/^~\/capabilities\//.test(source)) {
        addViolation(
          relativePath,
          'domain-import-capability',
          `Domain layer must not import capability layer: ${source}`,
          line,
        )
      }
      if (/^~\/routes\//.test(source)) {
        addViolation(
          relativePath,
          'domain-import-routes',
          `Domain layer must not import routes layer: ${source}`,
          line,
        )
      }
    }

    if (inCapabilityLayer && !testFile) {
      if (/^~\/modules\/[^/]+\/infrastructure\//.test(source)) {
        addViolation(
          relativePath,
          'capability-import-module-infrastructure',
          `Capability layer must not import module infrastructure: ${source}`,
          line,
        )
      }
    }

    if (inUiLayer && !testFile) {
      if (/^~\/modules\/[^/]+\/domain\//.test(source)) {
        addViolation(
          relativePath,
          'ui-import-domain',
          `UI layer must not import domain layer: ${source}`,
          line,
        )
      }
    }
  }

  if (inUiLayer && !testFile) {
    const forbiddenUiDerivations = [
      {
        regex:
          /import\s*{[^}]*\bderiveTimelineWithSeriesReadModel\b[^}]*}\s*from\s*['"]~\/modules\/tracking\/application\/projection\/tracking\.timeline\.readmodel['"]/m,
        rule: 'ui-import-tracking-derivation',
        message:
          'UI must not import deriveTimelineWithSeriesReadModel; consume backend timeline read model output.',
      },
      {
        regex:
          /import\s*{[^}]*\bclassifyTrackingSeries\b[^}]*}\s*from\s*['"]~\/modules\/tracking\/application\/projection\/tracking\.series\.classification['"]/m,
        rule: 'ui-import-tracking-classification',
        message:
          'UI must not classify tracking series; consume classified series from backend projection.',
      },
    ]

    for (const check of forbiddenUiDerivations) {
      const match = check.regex.exec(content)
      if (match) {
        addViolation(relativePath, check.rule, check.message, getLineNumber(content, match.index))
      }
    }
  }
}

function scanTypeContracts(relativePath, content) {
  const testFile = isTestFile(relativePath)
  const inHttpInterface = relativePath.includes('/interface/http/')
  const inApiSchemas = relativePath.startsWith('src/shared/api-schemas/')

  if (!testFile && !inHttpInterface && !inApiSchemas) {
    const dtoTypeRegex = /\b(?:type|interface|class)\s+([A-Za-z0-9_]*DTO)\b/g
    for (;;) {
      const dtoMatch = dtoTypeRegex.exec(content)
      if (dtoMatch === null) break
      addViolation(
        relativePath,
        'dto-suffix-outside-http',
        `DTO type name "${dtoMatch[1]}" is only allowed in interface/http or shared/api-schemas.`,
        getLineNumber(content, dtoMatch.index),
      )
    }
  }

  if (!testFile) {
    const entityUtilityRegex = /\b(?:Partial|Pick|Omit)\s*<\s*[A-Za-z0-9_]*Entity\b/g
    for (;;) {
      const entityMatch = entityUtilityRegex.exec(content)
      if (entityMatch === null) break
      addViolation(
        relativePath,
        'entity-utility-type-forbidden',
        `Forbidden utility type usage on Entity: "${entityMatch[0]}".`,
        getLineNumber(content, entityMatch.index),
      )
    }
  }
}

function scanViewModelExports(relativePath, content) {
  if (!relativePath.endsWith('.vm.ts')) return
  if (isTestFile(relativePath)) return

  const exportedFunctionRegex = /\bexport\s+function\s+[A-Za-z0-9_]+\s*\(/g
  for (;;) {
    const fnMatch = exportedFunctionRegex.exec(content)
    if (fnMatch === null) break
    addViolation(
      relativePath,
      'viewmodel-behavior-export',
      'ViewModel files (*.vm.ts) must not export behavioral functions.',
      getLineNumber(content, fnMatch.index),
    )
  }

  const exportedArrowRegex =
    /\bexport\s+const\s+[A-Za-z0-9_]+\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_]+)\s*=>/g
  for (;;) {
    const arrowMatch = exportedArrowRegex.exec(content)
    if (arrowMatch === null) break
    addViolation(
      relativePath,
      'viewmodel-behavior-export',
      'ViewModel files (*.vm.ts) must not export behavioral arrow functions.',
      getLineNumber(content, arrowMatch.index),
    )
  }
}

async function run() {
  const files = await walkFiles(srcDir)

  for (const absolutePath of files) {
    const content = await fs.readFile(absolutePath, 'utf8')
    const relativePath = toPosix(path.relative(rootDir, absolutePath))

    scanImports(relativePath, content)
    scanTypeContracts(relativePath, content)
    scanViewModelExports(relativePath, content)
  }

  if (violations.length === 0) {
    console.log('architecture-boundary-scan: OK')
    return
  }

  console.error(`architecture-boundary-scan: ${violations.length} violation(s) found`)
  for (const violation of violations) {
    const location = violation.line ? `${violation.file}:${violation.line}` : violation.file
    console.error(`- [${violation.rule}] ${location}`)
    console.error(`  ${violation.message}`)
  }
  process.exitCode = 1
}

run().catch((error) => {
  console.error('architecture-boundary-scan: failed to run')
  console.error(error)
  process.exitCode = 1
})
