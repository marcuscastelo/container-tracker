import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_SCOPE_PATH = 'docs/plans/coverage-scope.json'
export const DEFAULT_COVERAGE_FILE = 'coverage/vitest/coverage-final.json'
export const DEFAULT_JSON_OUT = 'coverage/coverage-policy-report.json'
export const DEFAULT_MD_OUT = 'coverage/coverage-policy-report.md'
export const DEFAULT_BASELINE_JSON = 'docs/plans/coverage-baseline.json'
export const DEFAULT_BASELINE_MD = 'docs/plans/coverage-baseline.md'

const METRIC_ORDER = ['lines', 'branches', 'functions', 'statements']

function toPosixPath(value) {
  return value.split(path.sep).join('/')
}

function roundPct(value) {
  return Number(value.toFixed(2))
}

function createMetricAccumulator() {
  return {
    covered: 0,
    total: 0,
  }
}

function createBucketAccumulator() {
  return {
    fileCount: 0,
    lines: createMetricAccumulator(),
    branches: createMetricAccumulator(),
    functions: createMetricAccumulator(),
    statements: createMetricAccumulator(),
  }
}

function finalizeMetric(metric) {
  if (metric.total === 0) {
    return {
      covered: 0,
      total: 0,
      pct: null,
    }
  }

  return {
    covered: metric.covered,
    total: metric.total,
    pct: roundPct((metric.covered / metric.total) * 100),
  }
}

function finalizeBucket(bucket) {
  return {
    fileCount: bucket.fileCount,
    lines: finalizeMetric(bucket.lines),
    branches: finalizeMetric(bucket.branches),
    functions: finalizeMetric(bucket.functions),
    statements: finalizeMetric(bucket.statements),
  }
}

function formatMetric(metric) {
  if (metric.pct === null) return 'n/a'
  return `${metric.pct.toFixed(2)}% (${metric.covered}/${metric.total})`
}

function formatDelta(value) {
  if (value === null) return 'n/a'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(2)} pp`
}

function parseArgs(argv) {
  const args = {
    scopePath: DEFAULT_SCOPE_PATH,
    coverageFile: DEFAULT_COVERAGE_FILE,
    jsonOut: DEFAULT_JSON_OUT,
    mdOut: DEFAULT_MD_OUT,
    baselineJson: DEFAULT_BASELINE_JSON,
    baselineMd: DEFAULT_BASELINE_MD,
    write: false,
    writeBaseline: false,
    githubSummary: false,
    quiet: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === '--scope') {
      args.scopePath = argv[index + 1]
      index += 1
      continue
    }

    if (token === '--coverage-file') {
      args.coverageFile = argv[index + 1]
      index += 1
      continue
    }

    if (token === '--json-out') {
      args.jsonOut = argv[index + 1]
      index += 1
      continue
    }

    if (token === '--md-out') {
      args.mdOut = argv[index + 1]
      index += 1
      continue
    }

    if (token === '--baseline-json') {
      args.baselineJson = argv[index + 1]
      index += 1
      continue
    }

    if (token === '--baseline-md') {
      args.baselineMd = argv[index + 1]
      index += 1
      continue
    }

    if (token === '--write') {
      args.write = true
      continue
    }

    if (token === '--write-baseline') {
      args.writeBaseline = true
      continue
    }

    if (token === '--github-summary') {
      args.githubSummary = true
      continue
    }

    if (token === '--quiet') {
      args.quiet = true
    }
  }

  return args
}

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function ensureParentDir(filePath) {
  mkdirSync(path.dirname(filePath), { recursive: true })
}

function writeJsonFile(filePath, payload) {
  ensureParentDir(filePath)
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function writeTextFile(filePath, content) {
  ensureParentDir(filePath)
  writeFileSync(filePath, `${content}\n`, 'utf8')
}

function toRelativeCoveragePath(cwd, filePath) {
  const normalized = toPosixPath(filePath)
  const normalizedCwd = toPosixPath(cwd)

  if (normalized.startsWith(`${normalizedCwd}/`)) {
    return normalized.slice(normalizedCwd.length + 1)
  }

  if (!path.isAbsolute(filePath)) {
    return toPosixPath(path.normalize(filePath))
  }

  return normalized
}

function matchesAnyGlob(value, patterns) {
  return patterns.some((pattern) => path.posix.matchesGlob(value, pattern))
}

function summarizeHits(hits) {
  const values = Object.values(hits ?? {})
  const total = values.length
  const covered = values.filter((value) => Number(value) > 0).length
  return { covered, total }
}

function summarizeBranches(branchHits) {
  let total = 0
  let covered = 0

  for (const value of Object.values(branchHits ?? {})) {
    if (!Array.isArray(value)) continue
    total += value.length
    covered += value.filter((count) => Number(count) > 0).length
  }

  return { covered, total }
}

function summarizeLines(statementMap, statementHits) {
  const lineHits = new Map()

  for (const [statementId, location] of Object.entries(statementMap ?? {})) {
    const line = location?.start?.line
    if (typeof line !== 'number') continue

    const hits = Number(statementHits?.[statementId] ?? 0)
    const previous = lineHits.get(line) ?? 0
    lineHits.set(line, Math.max(previous, hits))
  }

  return {
    covered: [...lineHits.values()].filter((value) => value > 0).length,
    total: lineHits.size,
  }
}

function summarizeCoverageEntry(entry) {
  return {
    lines: summarizeLines(entry.statementMap, entry.s),
    branches: summarizeBranches(entry.b),
    functions: summarizeHits(entry.f),
    statements: summarizeHits(entry.s),
  }
}

function addMetrics(targetBucket, metrics) {
  targetBucket.fileCount += 1

  for (const metricName of METRIC_ORDER) {
    targetBucket[metricName].covered += metrics[metricName].covered
    targetBucket[metricName].total += metrics[metricName].total
  }
}

function classifyModule(relativePath, scope) {
  for (const [bucketName, prefixes] of Object.entries(scope.modules)) {
    if (prefixes.some((prefix) => relativePath.startsWith(prefix))) {
      return bucketName
    }
  }

  return 'unclassified'
}

function classifyLayer(relativePath, scope) {
  for (const [bucketName, rule] of Object.entries(scope.layers)) {
    if ((rule.prefixes ?? []).some((prefix) => relativePath.startsWith(prefix))) {
      return bucketName
    }

    if ((rule.segments ?? []).some((segment) => relativePath.includes(segment))) {
      return bucketName
    }
  }

  return 'unclassified'
}

function classifyTrackingCritical(relativePath, scope) {
  for (const [bucketName, prefixes] of Object.entries(scope.trackingCritical)) {
    if (prefixes.some((prefix) => relativePath.startsWith(prefix))) {
      return bucketName
    }
  }

  return null
}

function createScopedBuckets(scopeSection) {
  return Object.fromEntries(
    Object.keys(scopeSection).map((bucketName) => [bucketName, createBucketAccumulator()]),
  )
}

function toSerializableDeltaBucket(currentBucket, baselineBucket) {
  const delta = {}

  for (const metricName of METRIC_ORDER) {
    const currentMetric = currentBucket?.[metricName] ?? null
    const baselineMetric = baselineBucket?.[metricName] ?? null

    if (currentMetric?.pct === null || baselineMetric?.pct === null || baselineMetric === null) {
      delta[metricName] = null
      continue
    }

    delta[metricName] = roundPct(currentMetric.pct - baselineMetric.pct)
  }

  return delta
}

function buildDelta(report, baseline) {
  if (!baseline) return null

  const delta = {
    global: toSerializableDeltaBucket(report.global, baseline.global),
    modules: {},
    layers: {},
    trackingCritical: {},
    unclassified: toSerializableDeltaBucket(
      report.unclassified.metrics,
      baseline.unclassified?.metrics,
    ),
  }

  for (const [bucketName, bucket] of Object.entries(report.modules)) {
    delta.modules[bucketName] = toSerializableDeltaBucket(bucket, baseline.modules?.[bucketName])
  }

  for (const [bucketName, bucket] of Object.entries(report.layers)) {
    delta.layers[bucketName] = toSerializableDeltaBucket(bucket, baseline.layers?.[bucketName])
  }

  for (const [bucketName, bucket] of Object.entries(report.trackingCritical)) {
    delta.trackingCritical[bucketName] = toSerializableDeltaBucket(
      bucket,
      baseline.trackingCritical?.[bucketName],
    )
  }

  return delta
}

function toDisplayTable(rows, columns) {
  const header = `| ${columns.map((column) => column.label).join(' | ')} |`
  const divider = `| ${columns.map(() => '---').join(' | ')} |`
  const body = rows.map((row) => {
    const cells = columns.map((column) => String(column.value(row)))
    return `| ${cells.join(' | ')} |`
  })

  return [header, divider, ...body].join('\n')
}

function bucketRows(buckets, deltaBuckets) {
  return Object.entries(buckets).map(([name, bucket]) => ({
    name,
    ...bucket,
    delta: deltaBuckets?.[name] ?? null,
  }))
}

export function buildCoveragePolicyReport({
  cwd,
  coverageMap,
  scope,
  baseline = null,
  coverageFile = DEFAULT_COVERAGE_FILE,
  scopePath = DEFAULT_SCOPE_PATH,
  baselinePath = DEFAULT_BASELINE_JSON,
}) {
  const globalBucket = createBucketAccumulator()
  const moduleBuckets = createScopedBuckets(scope.modules)
  const layerBuckets = {
    ...createScopedBuckets(scope.layers),
    unclassified: createBucketAccumulator(),
  }
  const trackingCriticalBuckets = createScopedBuckets(scope.trackingCritical)
  const unclassifiedFiles = []
  const scopedFiles = []

  for (const entry of Object.values(coverageMap)) {
    const relativePath = toRelativeCoveragePath(cwd, entry.path)

    if (!matchesAnyGlob(relativePath, scope.coverage.include)) continue
    if (matchesAnyGlob(relativePath, scope.coverage.exclude)) continue

    const metrics = summarizeCoverageEntry(entry)
    const moduleBucket = classifyModule(relativePath, scope)
    const layerBucket = classifyLayer(relativePath, scope)
    const trackingCriticalBucket = classifyTrackingCritical(relativePath, scope)

    addMetrics(globalBucket, metrics)
    addMetrics(moduleBuckets[moduleBucket], metrics)
    addMetrics(layerBuckets[layerBucket], metrics)

    if (trackingCriticalBucket) {
      addMetrics(trackingCriticalBuckets[trackingCriticalBucket], metrics)
    }

    if (layerBucket === 'unclassified') {
      unclassifiedFiles.push(relativePath)
    }

    scopedFiles.push({
      path: relativePath,
      module: moduleBucket,
      layer: layerBucket,
      trackingCritical: trackingCriticalBucket,
      metrics: {
        lines: finalizeMetric(metrics.lines),
        branches: finalizeMetric(metrics.branches),
        functions: finalizeMetric(metrics.functions),
        statements: finalizeMetric(metrics.statements),
      },
    })
  }

  const report = {
    generatedAt: new Date().toISOString(),
    scopePath,
    coverageFile,
    baselinePath,
    summary: {
      scopedFileCount: scopedFiles.length,
      unclassifiedFileCount: unclassifiedFiles.length,
      baselineStatus: baseline ? 'present' : 'missing',
    },
    global: finalizeBucket(globalBucket),
    modules: Object.fromEntries(
      Object.entries(moduleBuckets).map(([bucketName, bucket]) => [
        bucketName,
        finalizeBucket(bucket),
      ]),
    ),
    layers: Object.fromEntries(
      Object.entries(layerBuckets).map(([bucketName, bucket]) => [
        bucketName,
        finalizeBucket(bucket),
      ]),
    ),
    trackingCritical: Object.fromEntries(
      Object.entries(trackingCriticalBuckets).map(([bucketName, bucket]) => [
        bucketName,
        finalizeBucket(bucket),
      ]),
    ),
    unclassified: {
      files: unclassifiedFiles.sort((left, right) => left.localeCompare(right)),
      metrics: finalizeBucket(layerBuckets.unclassified),
    },
    files: scopedFiles.sort((left, right) => left.path.localeCompare(right.path)),
  }

  report.delta = buildDelta(report, baseline)

  return report
}

export function createBaselineSnapshot(report) {
  return {
    generatedAt: report.generatedAt,
    scopePath: report.scopePath,
    coverageFile: report.coverageFile,
    summary: report.summary,
    global: report.global,
    modules: report.modules,
    layers: report.layers,
    trackingCritical: report.trackingCritical,
    unclassified: report.unclassified,
  }
}

export function renderCoveragePolicyMarkdown(report) {
  const globalRows = [
    {
      name: 'global',
      ...report.global,
      delta: report.delta?.global ?? null,
    },
  ]

  const sections = [
    '# Coverage Policy Report',
    '',
    `- Generated at: \`${report.generatedAt}\``,
    `- Scope file: \`${report.scopePath}\``,
    `- Coverage file: \`${report.coverageFile}\``,
    `- Baseline status: **${report.summary.baselineStatus}**`,
    `- Scoped files: **${report.summary.scopedFileCount}**`,
    `- Unclassified files: **${report.summary.unclassifiedFileCount}**`,
    '',
    '## Global',
    '',
    toDisplayTable(globalRows, [
      { label: 'Bucket', value: (row) => row.name },
      { label: 'Lines', value: (row) => formatMetric(row.lines) },
      { label: 'Branches', value: (row) => formatMetric(row.branches) },
      { label: 'Functions', value: (row) => formatMetric(row.functions) },
      { label: 'Statements', value: (row) => formatMetric(row.statements) },
      { label: 'Files', value: (row) => row.fileCount },
      { label: 'Branch Delta', value: (row) => formatDelta(row.delta?.branches ?? null) },
    ]),
    '',
    '## By Module',
    '',
    toDisplayTable(bucketRows(report.modules, report.delta?.modules), [
      { label: 'Module', value: (row) => row.name },
      { label: 'Lines', value: (row) => formatMetric(row.lines) },
      { label: 'Branches', value: (row) => formatMetric(row.branches) },
      { label: 'Functions', value: (row) => formatMetric(row.functions) },
      { label: 'Statements', value: (row) => formatMetric(row.statements) },
      { label: 'Files', value: (row) => row.fileCount },
      { label: 'Branch Delta', value: (row) => formatDelta(row.delta?.branches ?? null) },
    ]),
    '',
    '## By Layer',
    '',
    toDisplayTable(bucketRows(report.layers, report.delta?.layers), [
      { label: 'Layer', value: (row) => row.name },
      { label: 'Lines', value: (row) => formatMetric(row.lines) },
      { label: 'Branches', value: (row) => formatMetric(row.branches) },
      { label: 'Functions', value: (row) => formatMetric(row.functions) },
      { label: 'Statements', value: (row) => formatMetric(row.statements) },
      { label: 'Files', value: (row) => row.fileCount },
      { label: 'Branch Delta', value: (row) => formatDelta(row.delta?.branches ?? null) },
    ]),
    '',
    '## Tracking Critical',
    '',
    toDisplayTable(bucketRows(report.trackingCritical, report.delta?.trackingCritical), [
      { label: 'Area', value: (row) => row.name },
      { label: 'Lines', value: (row) => formatMetric(row.lines) },
      { label: 'Branches', value: (row) => formatMetric(row.branches) },
      { label: 'Functions', value: (row) => formatMetric(row.functions) },
      { label: 'Statements', value: (row) => formatMetric(row.statements) },
      { label: 'Files', value: (row) => row.fileCount },
      { label: 'Branch Delta', value: (row) => formatDelta(row.delta?.branches ?? null) },
    ]),
    '',
    '## Unclassified',
    '',
    toDisplayTable(
      [
        {
          name: 'unclassified',
          ...report.unclassified.metrics,
          delta: report.delta?.unclassified ?? null,
        },
      ],
      [
        { label: 'Bucket', value: (row) => row.name },
        { label: 'Lines', value: (row) => formatMetric(row.lines) },
        { label: 'Branches', value: (row) => formatMetric(row.branches) },
        { label: 'Functions', value: (row) => formatMetric(row.functions) },
        { label: 'Statements', value: (row) => formatMetric(row.statements) },
        { label: 'Files', value: (row) => row.fileCount },
        { label: 'Branch Delta', value: (row) => formatDelta(row.delta?.branches ?? null) },
      ],
    ),
    '',
    report.unclassified.files.length > 0
      ? report.unclassified.files.map((file) => `- \`${file}\``).join('\n')
      : '- No unclassified files in scope.',
    '',
    '## Notes',
    '',
    '- `unclassified` is diagnostic in v0 and does not fail the build.',
    '- Deltas are informational only in v0; no threshold gate is enforced here.',
  ]

  return sections.join('\n')
}

export function renderCoverageBaselineMarkdown(snapshot) {
  return [
    '# Coverage Baseline',
    '',
    `- Generated at: \`${snapshot.generatedAt}\``,
    `- Scope file: \`${snapshot.scopePath}\``,
    `- Coverage file: \`${snapshot.coverageFile}\``,
    '',
    '## Global',
    '',
    toDisplayTable(
      [
        {
          name: 'global',
          ...snapshot.global,
        },
      ],
      [
        { label: 'Bucket', value: (row) => row.name },
        { label: 'Lines', value: (row) => formatMetric(row.lines) },
        { label: 'Branches', value: (row) => formatMetric(row.branches) },
        { label: 'Functions', value: (row) => formatMetric(row.functions) },
        { label: 'Statements', value: (row) => formatMetric(row.statements) },
        { label: 'Files', value: (row) => row.fileCount },
      ],
    ),
    '',
    '## By Module',
    '',
    toDisplayTable(bucketRows(snapshot.modules, null), [
      { label: 'Module', value: (row) => row.name },
      { label: 'Lines', value: (row) => formatMetric(row.lines) },
      { label: 'Branches', value: (row) => formatMetric(row.branches) },
      { label: 'Functions', value: (row) => formatMetric(row.functions) },
      { label: 'Statements', value: (row) => formatMetric(row.statements) },
      { label: 'Files', value: (row) => row.fileCount },
    ]),
    '',
    '## By Layer',
    '',
    toDisplayTable(bucketRows(snapshot.layers, null), [
      { label: 'Layer', value: (row) => row.name },
      { label: 'Lines', value: (row) => formatMetric(row.lines) },
      { label: 'Branches', value: (row) => formatMetric(row.branches) },
      { label: 'Functions', value: (row) => formatMetric(row.functions) },
      { label: 'Statements', value: (row) => formatMetric(row.statements) },
      { label: 'Files', value: (row) => row.fileCount },
    ]),
    '',
    '## Tracking Critical',
    '',
    toDisplayTable(bucketRows(snapshot.trackingCritical, null), [
      { label: 'Area', value: (row) => row.name },
      { label: 'Lines', value: (row) => formatMetric(row.lines) },
      { label: 'Branches', value: (row) => formatMetric(row.branches) },
      { label: 'Functions', value: (row) => formatMetric(row.functions) },
      { label: 'Statements', value: (row) => formatMetric(row.statements) },
      { label: 'Files', value: (row) => row.fileCount },
    ]),
    '',
    '## Unclassified',
    '',
    snapshot.unclassified.files.length > 0
      ? snapshot.unclassified.files.map((file) => `- \`${file}\``).join('\n')
      : '- No unclassified files in scope.',
    '',
    '## Notes',
    '',
    '- This file is generated by `pnpm run coverage:baseline`.',
    '- Use it as the reference point for anti-regression deltas in Coverage Policy v0.',
  ].join('\n')
}

export function renderGithubSummary(report) {
  return [
    '## Coverage Policy v0',
    '',
    `- Baseline status: **${report.summary.baselineStatus}**`,
    `- Scoped files: **${report.summary.scopedFileCount}**`,
    `- Unclassified files: **${report.summary.unclassifiedFileCount}**`,
    '',
    toDisplayTable(
      [
        {
          name: 'global',
          ...report.global,
          delta: report.delta?.global ?? null,
        },
      ],
      [
        { label: 'Bucket', value: (row) => row.name },
        { label: 'Lines', value: (row) => formatMetric(row.lines) },
        { label: 'Branches', value: (row) => formatMetric(row.branches) },
        { label: 'Branch Delta', value: (row) => formatDelta(row.delta?.branches ?? null) },
      ],
    ),
    '',
    toDisplayTable(bucketRows(report.modules, report.delta?.modules), [
      { label: 'Module', value: (row) => row.name },
      { label: 'Branches', value: (row) => formatMetric(row.branches) },
      { label: 'Branch Delta', value: (row) => formatDelta(row.delta?.branches ?? null) },
      { label: 'Files', value: (row) => row.fileCount },
    ]),
    '',
    toDisplayTable(bucketRows(report.trackingCritical, report.delta?.trackingCritical), [
      { label: 'Tracking Critical', value: (row) => row.name },
      { label: 'Branches', value: (row) => formatMetric(row.branches) },
      { label: 'Branch Delta', value: (row) => formatDelta(row.delta?.branches ?? null) },
      { label: 'Files', value: (row) => row.fileCount },
    ]),
  ].join('\n')
}

function printConsoleSummary(report) {
  console.log('Coverage Policy Report')
  console.log(`- Scoped files: ${report.summary.scopedFileCount}`)
  console.log(`- Baseline status: ${report.summary.baselineStatus}`)
  console.log(`- Unclassified files: ${report.summary.unclassifiedFileCount}`)
  console.log(
    `- Global branches: ${formatMetric(report.global.branches)} (${formatDelta(
      report.delta?.global?.branches ?? null,
    )})`,
  )
  console.log('')
  console.log(
    toDisplayTable(bucketRows(report.modules, report.delta?.modules), [
      { label: 'Module', value: (row) => row.name },
      { label: 'Branches', value: (row) => formatMetric(row.branches) },
      { label: 'Branch Delta', value: (row) => formatDelta(row.delta?.branches ?? null) },
      { label: 'Files', value: (row) => row.fileCount },
    ]),
  )
}

export function runCoveragePolicyReportCli(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv)
  const cwd = process.cwd()
  const scopePath = path.resolve(cwd, args.scopePath)
  const coverageFile = path.resolve(cwd, args.coverageFile)
  const baselineJsonPath = path.resolve(cwd, args.baselineJson)
  const baselineMdPath = path.resolve(cwd, args.baselineMd)

  const scope = readJsonFile(scopePath)
  const coverageMap = readJsonFile(coverageFile)
  let baseline = null

  try {
    baseline = readJsonFile(baselineJsonPath)
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      throw error
    }
  }

  const report = buildCoveragePolicyReport({
    cwd,
    coverageMap,
    scope,
    baseline,
    coverageFile: args.coverageFile,
    scopePath: args.scopePath,
    baselinePath: args.baselineJson,
  })

  if (!args.quiet) {
    printConsoleSummary(report)
  }

  if (args.write) {
    writeJsonFile(path.resolve(cwd, args.jsonOut), report)
    writeTextFile(path.resolve(cwd, args.mdOut), renderCoveragePolicyMarkdown(report))
  }

  if (args.writeBaseline) {
    const snapshot = createBaselineSnapshot(report)
    writeJsonFile(baselineJsonPath, snapshot)
    writeTextFile(baselineMdPath, renderCoverageBaselineMarkdown(snapshot))
  }

  if (args.githubSummary && env.GITHUB_STEP_SUMMARY) {
    writeFileSync(env.GITHUB_STEP_SUMMARY, `${renderGithubSummary(report)}\n`, {
      encoding: 'utf8',
      flag: 'a',
    })
  }

  return report
}

const executedAsScript =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (executedAsScript) {
  runCoveragePolicyReportCli()
}
