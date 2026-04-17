#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const rootDir = process.cwd()
const agentSrcDir = path.join(rootDir, 'apps', 'agent', 'src')
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs'])

/** @type {Array<{file: string, line: number | null, rule: string, message: string}>} */
const violations = []

function toPosix(filePath) {
  return filePath.split(path.sep).join('/')
}

function isTestFile(relativePath) {
  return (
    relativePath.includes('/tests/') ||
    relativePath.includes('/__tests__/') ||
    /\.test\.[mc]?[jt]sx?$/u.test(relativePath) ||
    /\.spec\.[mc]?[jt]sx?$/u.test(relativePath)
  )
}

function getLineNumber(content, index) {
  if (index < 0) {
    return null
  }

  let line = 1
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (content[cursor] === '\n') {
      line += 1
    }
  }

  return line
}

function addViolation(file, line, rule, message) {
  violations.push({
    file,
    line,
    rule,
    message,
  })
}

async function walk(currentPath) {
  const entries = await fs.readdir(currentPath, { withFileTypes: true })
  /** @type {string[]} */
  const files = []

  for (const entry of entries) {
    const absolutePath = path.join(currentPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(absolutePath)))
      continue
    }

    if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      files.push(absolutePath)
    }
  }

  return files
}

function hasRestrictedImport(content, patterns) {
  return patterns.some((pattern) => pattern.test(content))
}

function scanFile(command) {
  const { relativePath, content } = command
  const testFile = isTestFile(relativePath)

  if (!relativePath.startsWith('apps/agent/src/platform/') && !testFile) {
    const processPlatformPattern = /\bprocess\.platform\b/gu
    for (;;) {
      const match = processPlatformPattern.exec(content)
      if (!match) {
        break
      }

      addViolation(
        relativePath,
        getLineNumber(content, match.index),
        'process-platform-outside-platform',
        'process.platform is only allowed inside apps/agent/src/platform/*',
      )
    }
  }

  if (relativePath.startsWith('apps/agent/src/release/') && !testFile) {
    const restricted = hasRestrictedImport(content, [
      /from\s+['"]@agent\/sync\//u,
      /from\s+['"]@agent\/providers\//u,
      /require\(\s*['"]@agent\/sync\//u,
      /require\(\s*['"]@agent\/providers\//u,
    ])

    if (restricted) {
      addViolation(
        relativePath,
        null,
        'release-import-sync-providers',
        'release/* must not import sync/* or providers/* modules.',
      )
    }
  }

  if (relativePath.startsWith('apps/agent/src/providers/') && !testFile) {
    const restricted = hasRestrictedImport(content, [
      /from\s+['"]@agent\/sync\//u,
      /require\(\s*['"]@agent\/sync\//u,
    ])

    if (restricted) {
      addViolation(
        relativePath,
        null,
        'providers-import-sync',
        'providers/* must not import sync orchestration modules.',
      )
    }
  }

  if (relativePath.startsWith('apps/agent/src/app/') && !testFile) {
    const restricted = hasRestrictedImport(content, [
      /from\s+['"]@agent\/release\/domain\//u,
      /from\s+['"]@agent\/runtime\/domain\//u,
      /from\s+['"]@agent\/sync\/domain\//u,
    ])

    if (restricted) {
      addViolation(
        relativePath,
        null,
        'app-import-domain-policy',
        'app/* must compose services only and must not import domain policy modules.',
      )
    }
  }

  if (relativePath.startsWith('apps/agent/src/core/contracts/') || testFile) {
    return
  }

  const forbiddenTypeNames = [
    'ProviderInput',
    'ProviderRunResult',
    'AgentSyncJob',
    'ReleaseState',
    'RuntimeState',
    'HeartbeatPayload',
    'UnifiedReleaseManifest',
    'UpdateManifestResponseDTO',
  ]
  const forbiddenSchemaNames = [
    'ProviderInputSchema',
    'ProviderRunResultSchema',
    'AgentSyncJobSchema',
    'ReleaseStateSchema',
    'RuntimeStateSchema',
    'HeartbeatPayloadSchema',
    'UnifiedReleaseManifestSchema',
    'UpdateManifestResponseDTOSchema',
  ]

  for (const typeName of forbiddenTypeNames) {
    const patterns = [
      new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?type\\s+${typeName}\\s*=`, 'gu'),
      new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?interface\\s+${typeName}\\b`, 'gu'),
      new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?class\\s+${typeName}\\b`, 'gu'),
    ]

    let matchedIndex = -1
    for (const pattern of patterns) {
      const match = pattern.exec(content)
      if (match) {
        matchedIndex = match.index
        break
      }
    }

    if (matchedIndex >= 0) {
      addViolation(
        relativePath,
        getLineNumber(content, matchedIndex),
        'critical-contract-redefinition',
        `Critical contract "${typeName}" must be declared only in apps/agent/src/core/contracts/*.`,
      )
    }
  }

  for (const schemaName of forbiddenSchemaNames) {
    const pattern = new RegExp(`\\bconst\\s+${schemaName}\\s*=`, 'gu')
    const match = pattern.exec(content)
    if (!match) {
      continue
    }

    addViolation(
      relativePath,
      getLineNumber(content, match.index),
      'critical-contract-schema-redefinition',
      `Critical schema "${schemaName}" must be declared only in apps/agent/src/core/contracts/*.`,
    )
  }
}

async function run() {
  const files = await walk(agentSrcDir)
  for (const absolutePath of files) {
    const content = await fs.readFile(absolutePath, 'utf8')
    const relativePath = toPosix(path.relative(rootDir, absolutePath))
    scanFile({ relativePath, content })
  }

  if (violations.length === 0) {
    console.log('agent-boundary-scan: OK')
    return
  }

  console.error(`agent-boundary-scan: ${violations.length} violation(s) found`)
  for (const violation of violations) {
    const location = violation.line ? `${violation.file}:${violation.line}` : violation.file
    console.error(`- [${violation.rule}] ${location}`)
    console.error(`  ${violation.message}`)
  }

  process.exitCode = 1
}

run().catch((error) => {
  console.error('agent-boundary-scan: failed to run')
  console.error(error)
  process.exitCode = 1
})
