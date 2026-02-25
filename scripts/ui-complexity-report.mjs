import { writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  classifyUiFiles,
  collectEslintMetrics,
  collectJsxMetrics,
  DEFAULT_BASELINE_JSON_PATH,
  DEFAULT_BASELINE_MD_PATH,
  DEFAULT_SCOPE_PATH,
  readJsonFile,
} from './ui-complexity.shared.mjs'

function parseArgs(argv) {
  const args = {
    scopePath: DEFAULT_SCOPE_PATH,
    jsonOut: DEFAULT_BASELINE_JSON_PATH,
    mdOut: DEFAULT_BASELINE_MD_PATH,
    write: false,
    quiet: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--scope') {
      args.scopePath = argv[index + 1]
      index += 1
    } else if (token === '--json-out') {
      args.jsonOut = argv[index + 1]
      index += 1
    } else if (token === '--md-out') {
      args.mdOut = argv[index + 1]
      index += 1
    } else if (token === '--write') {
      args.write = true
    } else if (token === '--quiet') {
      args.quiet = true
    }
  }

  return args
}

function topBy(records, selector, limit = 10) {
  const cloned = [...records]
  cloned.sort((left, right) => selector(right) - selector(left))
  return cloned.slice(0, limit)
}

function formatTable(rows, columns) {
  const header = `| ${columns.map((column) => column.label).join(' | ')} |`
  const divider = `| ${columns.map(() => '---').join(' | ')} |`
  const body = rows.map((row) => {
    const cells = columns.map((column) => String(column.value(row)))
    return `| ${cells.join(' | ')} |`
  })

  return [header, divider, ...body].join('\n')
}

const args = parseArgs(process.argv.slice(2))
const cwd = process.cwd()
const scope = readJsonFile(args.scopePath)
const fileEntries = classifyUiFiles(cwd, scope)
const jsxMetricsByFile = collectJsxMetrics(fileEntries)
const eslintMetricsByFile = await collectEslintMetrics(
  cwd,
  fileEntries,
  scope.thresholds.eslintSoft,
  'warn',
)

const files = fileEntries.map((entry) => {
  const jsx = jsxMetricsByFile.get(entry.file) ?? { loc: 0, jsxDepth: 0, jsxElements: 0 }
  const eslint = eslintMetricsByFile.get(entry.file) ?? {
    violationCount: 0,
    ruleCounts: {
      complexity: 0,
      maxLinesFn: 0,
      maxDepth: 0,
      maxNestedCallbacks: 0,
    },
    maxObserved: {
      complexity: null,
      maxLinesFn: null,
      maxDepth: null,
      maxNestedCallbacks: null,
    },
  }

  return {
    file: entry.file,
    bucket: entry.bucket,
    loc: jsx.loc,
    jsxDepth: jsx.jsxDepth,
    jsxElements: jsx.jsxElements,
    complexity: eslint.maxObserved.complexity,
    maxLinesFn: eslint.maxObserved.maxLinesFn,
    maxDepth: eslint.maxObserved.maxDepth,
    maxNestedCallbacks: eslint.maxObserved.maxNestedCallbacks,
    softViolationCount: eslint.violationCount,
    softViolations: eslint.ruleCounts,
  }
})

const summary = {
  totalFiles: files.length,
  componentFiles: files.filter((file) => file.bucket === 'components').length,
  pagesLikeFiles: files.filter((file) => file.bucket === 'pages-like').length,
  supportFiles: files.filter((file) => file.bucket === 'support').length,
  totalSoftViolations: files.reduce((acc, file) => acc + file.softViolationCount, 0),
}

const top = {
  byLoc: topBy(files, (file) => file.loc, 12),
  byJsxDepth: topBy(files, (file) => file.jsxDepth, 12),
  byJsxElements: topBy(files, (file) => file.jsxElements, 12),
  bySoftViolations: topBy(files, (file) => file.softViolationCount, 12),
}

const report = {
  generatedAt: new Date().toISOString(),
  scopePath: args.scopePath,
  thresholds: scope.thresholds,
  summary,
  top,
  files,
}

if (!args.quiet) {
  console.log('UI Complexity Report')
  console.log(`- Files scanned: ${summary.totalFiles}`)
  console.log(`- Components: ${summary.componentFiles}`)
  console.log(`- Pages-like: ${summary.pagesLikeFiles}`)
  console.log(`- Support: ${summary.supportFiles}`)
  console.log(`- Soft violations: ${summary.totalSoftViolations}`)
  console.log('')

  const topLoc = top.byLoc.slice(0, 8).map((file) => ({
    file: file.file,
    bucket: file.bucket,
    loc: file.loc,
    jsxDepth: file.jsxDepth,
    jsxElements: file.jsxElements,
    violations: file.softViolationCount,
  }))

  console.log(
    formatTable(topLoc, [
      { label: 'File', value: (row) => row.file },
      { label: 'Bucket', value: (row) => row.bucket },
      { label: 'LOC', value: (row) => row.loc },
      { label: 'JSX Depth', value: (row) => row.jsxDepth },
      { label: 'JSX Elements', value: (row) => row.jsxElements },
      { label: 'Soft Violations', value: (row) => row.violations },
    ]),
  )
}

if (args.write) {
  const jsonOutPath = path.resolve(cwd, args.jsonOut)
  const mdOutPath = path.resolve(cwd, args.mdOut)

  writeFileSync(jsonOutPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  const md = [
    '# UI Complexity Baseline',
    '',
    `- Generated at: \`${report.generatedAt}\``,
    `- Scope file: \`${args.scopePath}\``,
    '',
    '## Summary',
    '',
    `- Total files: **${summary.totalFiles}**`,
    `- Components: **${summary.componentFiles}**`,
    `- Pages-like: **${summary.pagesLikeFiles}**`,
    `- Support: **${summary.supportFiles}**`,
    `- Soft violations: **${summary.totalSoftViolations}**`,
    '',
    '## Top by LOC',
    '',
    formatTable(top.byLoc, [
      { label: 'File', value: (row) => `\`${row.file}\`` },
      { label: 'Bucket', value: (row) => row.bucket },
      { label: 'LOC', value: (row) => row.loc },
      { label: 'JSX Depth', value: (row) => row.jsxDepth },
      { label: 'JSX Elements', value: (row) => row.jsxElements },
      { label: 'Soft Violations', value: (row) => row.softViolationCount },
    ]),
    '',
    '## Top by JSX Depth',
    '',
    formatTable(top.byJsxDepth, [
      { label: 'File', value: (row) => `\`${row.file}\`` },
      { label: 'Bucket', value: (row) => row.bucket },
      { label: 'JSX Depth', value: (row) => row.jsxDepth },
      { label: 'JSX Elements', value: (row) => row.jsxElements },
      { label: 'LOC', value: (row) => row.loc },
    ]),
    '',
    '## Top by JSX Elements',
    '',
    formatTable(top.byJsxElements, [
      { label: 'File', value: (row) => `\`${row.file}\`` },
      { label: 'Bucket', value: (row) => row.bucket },
      { label: 'JSX Elements', value: (row) => row.jsxElements },
      { label: 'JSX Depth', value: (row) => row.jsxDepth },
      { label: 'LOC', value: (row) => row.loc },
    ]),
    '',
    '## Top by Soft Violations',
    '',
    formatTable(top.bySoftViolations, [
      { label: 'File', value: (row) => `\`${row.file}\`` },
      { label: 'Bucket', value: (row) => row.bucket },
      { label: 'Soft Violations', value: (row) => row.softViolationCount },
      { label: 'Complexity (max observed)', value: (row) => row.complexity ?? '-' },
      { label: 'Max lines/function (max observed)', value: (row) => row.maxLinesFn ?? '-' },
    ]),
    '',
    '## Thresholds Used (Soft)',
    '',
    '```json',
    JSON.stringify(scope.thresholds.eslintSoft, null, 2),
    '```',
    '',
    '```json',
    JSON.stringify(scope.thresholds.jsx, null, 2),
    '```',
    '',
    '## Notes',
    '',
    '- This file is generated by `pnpm run ui:complexity:report -- --write`.',
    '- Hotspot claims become canonical only after this baseline is regenerated in the current commit.',
  ].join('\n')

  writeFileSync(mdOutPath, `${md}\n`, 'utf8')
  if (!args.quiet) {
    console.log('')
    console.log(`Baseline JSON written to: ${args.jsonOut}`)
    console.log(`Baseline MD written to: ${args.mdOut}`)
  }
}
