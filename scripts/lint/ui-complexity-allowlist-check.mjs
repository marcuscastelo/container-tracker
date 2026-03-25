import { existsSync } from 'node:fs'
import path from 'node:path'
import {
  classifyUiFiles,
  collectJsxMetrics,
  DEFAULT_ALLOWLIST_PATH,
  DEFAULT_SCOPE_PATH,
  readJsonFile,
  verifyRuleThreshold,
} from './ui-complexity.shared.mjs'

function parseArgs(argv) {
  const args = {
    scopePath: DEFAULT_SCOPE_PATH,
    allowlistPath: DEFAULT_ALLOWLIST_PATH,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--scope') {
      args.scopePath = argv[index + 1]
      index += 1
    } else if (token === '--allowlist') {
      args.allowlistPath = argv[index + 1]
      index += 1
    }
  }

  return args
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

const args = parseArgs(process.argv.slice(2))
const cwd = process.cwd()
const scope = readJsonFile(args.scopePath)
const allowlist = readJsonFile(args.allowlistPath)

const scopeEntries = classifyUiFiles(cwd, scope)
const scopeByFile = new Map(scopeEntries.map((entry) => [entry.file, entry]))

const failures = []

const seenFiles = new Set()
for (const entry of allowlist.entries ?? []) {
  if (!isNonEmptyString(entry.file)) {
    failures.push('Allowlist entry has invalid `file` value.')
    continue
  }

  if (seenFiles.has(entry.file)) {
    failures.push(`Allowlist contains duplicate file entry: ${entry.file}`)
  }
  seenFiles.add(entry.file)

  if (!isNonEmptyString(entry.reason)) {
    failures.push(`Allowlist entry missing non-empty reason: ${entry.file}`)
  }

  if (!isNonEmptyString(entry.expiresAt)) {
    failures.push(`Allowlist entry missing expiresAt: ${entry.file}`)
  } else if (entry.expiresAt < todayIsoDate()) {
    failures.push(`Allowlist entry expired (${entry.expiresAt}): ${entry.file}`)
  }

  if (!scopeByFile.has(entry.file)) {
    failures.push(`Allowlist file is outside configured UI scope: ${entry.file}`)
  }
}

const allowlistFiles = new Set((allowlist.entries ?? []).map((entry) => entry.file))

const jsxMetricsByFile = collectJsxMetrics(scopeEntries)

for (const entry of scopeEntries) {
  if (allowlistFiles.has(entry.file)) continue
  if (entry.bucket !== 'components' && entry.bucket !== 'pages-like') continue

  const jsx = jsxMetricsByFile.get(entry.file)
  if (!jsx) continue

  const threshold =
    entry.bucket === 'components' ? scope.thresholds.jsx.components : scope.thresholds.jsx.pagesLike

  if (jsx.jsxDepth > threshold.depth) {
    failures.push(
      `JSX depth regression for non-allowlisted file ${entry.file}: ${jsx.jsxDepth} > ${threshold.depth}`,
    )
  }

  if (jsx.jsxElements > threshold.elements) {
    failures.push(
      `JSX element count regression for non-allowlisted file ${entry.file}: ${jsx.jsxElements} > ${threshold.elements}`,
    )
  }
}

const metricToRule = {
  complexity: 'complexity',
  maxLinesFn: 'max-lines-per-function',
  maxDepth: 'max-depth',
  maxNestedCallbacks: 'max-nested-callbacks',
}

for (const entry of allowlist.entries ?? []) {
  if (!scopeByFile.has(entry.file)) continue

  const filePath = path.resolve(cwd, entry.file)
  if (!existsSync(filePath)) {
    failures.push(`Allowlisted file not found: ${entry.file}`)
    continue
  }

  const jsx = jsxMetricsByFile.get(entry.file)
  if (!jsx) {
    failures.push(`Could not compute JSX metrics for allowlisted file: ${entry.file}`)
    continue
  }

  const baseline = entry.baseline ?? {}

  if (typeof baseline.jsxDepth === 'number' && jsx.jsxDepth > baseline.jsxDepth) {
    failures.push(
      `Allowlisted file exceeded baseline jsxDepth for ${entry.file}: ${jsx.jsxDepth} > ${baseline.jsxDepth}`,
    )
  }

  if (typeof baseline.jsxElements === 'number' && jsx.jsxElements > baseline.jsxElements) {
    failures.push(
      `Allowlisted file exceeded baseline jsxElements for ${entry.file}: ${jsx.jsxElements} > ${baseline.jsxElements}`,
    )
  }

  for (const [metric, ruleName] of Object.entries(metricToRule)) {
    const threshold = baseline[metric]
    if (typeof threshold !== 'number') continue

    const result = await verifyRuleThreshold(cwd, entry.file, ruleName, threshold)
    if (!result.ok) {
      failures.push(
        `Allowlisted file exceeded baseline ${metric} for ${entry.file}: > ${threshold}`,
      )
    }
  }
}

if (failures.length > 0) {
  console.error('ui:complexity:allowlist:check failed')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('ui:complexity:allowlist:check passed')
console.log(`- Checked files in scope: ${scopeEntries.length}`)
console.log(`- Allowlist entries: ${(allowlist.entries ?? []).length}`)
