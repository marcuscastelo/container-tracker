import { globSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { ESLint } from 'eslint'
import ts from 'typescript'

export const DEFAULT_SCOPE_PATH = 'docs/plans/ui-complexity-scope.json'
export const DEFAULT_ALLOWLIST_PATH = 'docs/plans/ui-complexity-allowlist.json'
export const DEFAULT_BASELINE_JSON_PATH = 'docs/plans/ui-complexity-baseline.json'
export const DEFAULT_BASELINE_MD_PATH = 'docs/plans/ui-complexity-baseline.md'

function toPosixPath(value) {
  return value.split(path.sep).join('/')
}

export function toRelativePath(cwd, absolutePath) {
  return toPosixPath(path.relative(cwd, absolutePath))
}

export function readJsonFile(filePath) {
  const content = readFileSync(filePath, 'utf8')
  return JSON.parse(content)
}

function resolveGlobFiles(cwd, globs) {
  const files = new Set()

  for (const pattern of globs) {
    const matched = globSync(pattern, {
      cwd,
      absolute: true,
      nodir: true,
      dot: false,
    })

    for (const file of matched) {
      files.add(path.resolve(file))
    }
  }

  return files
}

export function classifyUiFiles(cwd, scope) {
  const allFilesAbs = resolveGlobFiles(cwd, scope.allUiGlobs ?? [])
  const componentFilesAbs = resolveGlobFiles(cwd, scope.componentsGlobs ?? [])
  const pagesLikeFilesAbs = resolveGlobFiles(cwd, scope.pagesLikeGlobs ?? [])

  for (const override of scope.pagesLikeOverrides ?? []) {
    const overrideAbs = path.resolve(cwd, override)
    if (allFilesAbs.has(overrideAbs) || globSync(override, { cwd, nodir: true }).length > 0) {
      pagesLikeFilesAbs.add(overrideAbs)
      allFilesAbs.add(overrideAbs)
    }
  }

  const files = []
  for (const fileAbs of allFilesAbs) {
    const file = toRelativePath(cwd, fileAbs)
    let bucket = 'support'

    if (pagesLikeFilesAbs.has(fileAbs)) {
      bucket = 'pages-like'
    } else if (componentFilesAbs.has(fileAbs)) {
      bucket = 'components'
    }

    files.push({ file, absolutePath: fileAbs, bucket })
  }

  files.sort((a, b) => a.file.localeCompare(b.file))
  return files
}

export function collectJsxMetrics(fileEntries) {
  const metrics = new Map()

  for (const entry of fileEntries) {
    const source = readFileSync(entry.absolutePath, 'utf8')
    const sourceFile = ts.createSourceFile(
      entry.absolutePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      entry.file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )

    let maxDepth = 0
    let jsxElements = 0

    const visit = (node, depth) => {
      let nextDepth = depth
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
        jsxElements += 1
        nextDepth += 1
      }

      if (nextDepth > maxDepth) {
        maxDepth = nextDepth
      }

      ts.forEachChild(node, (child) => visit(child, nextDepth))
    }

    visit(sourceFile, 0)

    metrics.set(entry.file, {
      loc: source.split('\n').length,
      jsxDepth: maxDepth,
      jsxElements,
    })
  }

  return metrics
}

function parseRuleValue(ruleId, message) {
  if (ruleId === 'complexity') {
    const match = message.match(/complexity of (\d+)/)
    return match ? Number(match[1]) : null
  }

  if (
    ruleId === 'max-lines-per-function' ||
    ruleId === 'max-depth' ||
    ruleId === 'max-nested-callbacks'
  ) {
    const match = message.match(/\((\d+)\)/)
    return match ? Number(match[1]) : null
  }

  return null
}

function buildBucketRules(severity, thresholds, bucket) {
  const level = severity === 'error' ? 'error' : 'warn'
  const rules = {
    'max-lines-per-function': [level, thresholds.maxLinesPerFunction],
  }

  if (bucket === 'components') {
    rules.complexity = [level, thresholds.components.complexity]
    rules['max-depth'] = [level, thresholds.components.maxDepth]
    rules['max-nested-callbacks'] = [level, thresholds.components.maxNestedCallbacks]
  }

  if (bucket === 'pages-like') {
    rules.complexity = [level, thresholds.pagesLike.complexity]
    rules['max-depth'] = [level, thresholds.pagesLike.maxDepth]
    rules['max-nested-callbacks'] = [level, thresholds.pagesLike.maxNestedCallbacks]
  }

  return rules
}

export async function collectEslintMetrics(cwd, fileEntries, thresholds, severity) {
  const scopedRuleIds = new Set([
    'complexity',
    'max-lines-per-function',
    'max-depth',
    'max-nested-callbacks',
  ])

  const byFile = new Map()

  const buckets = ['components', 'pages-like', 'support']
  for (const bucket of buckets) {
    const files = fileEntries.filter((entry) => entry.bucket === bucket).map((entry) => entry.file)
    if (files.length === 0) continue

    const eslint = new ESLint({
      cwd,
      overrideConfigFile: 'eslint.config.mjs',
      overrideConfig: {
        rules: buildBucketRules(severity, thresholds, bucket),
      },
    })

    const results = await eslint.lintFiles(files)
    for (const result of results) {
      const relativePath = toRelativePath(cwd, result.filePath)
      const existing = byFile.get(relativePath) ?? {
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

      for (const message of result.messages) {
        if (!scopedRuleIds.has(message.ruleId ?? '')) continue

        existing.violationCount += 1

        if (message.ruleId === 'complexity') {
          existing.ruleCounts.complexity += 1
        }
        if (message.ruleId === 'max-lines-per-function') {
          existing.ruleCounts.maxLinesFn += 1
        }
        if (message.ruleId === 'max-depth') {
          existing.ruleCounts.maxDepth += 1
        }
        if (message.ruleId === 'max-nested-callbacks') {
          existing.ruleCounts.maxNestedCallbacks += 1
        }

        const value = parseRuleValue(message.ruleId, message.message)
        if (value === null) continue

        if (message.ruleId === 'complexity') {
          const previous = existing.maxObserved.complexity
          existing.maxObserved.complexity = previous === null ? value : Math.max(previous, value)
        }

        if (message.ruleId === 'max-lines-per-function') {
          const previous = existing.maxObserved.maxLinesFn
          existing.maxObserved.maxLinesFn = previous === null ? value : Math.max(previous, value)
        }

        if (message.ruleId === 'max-depth') {
          const previous = existing.maxObserved.maxDepth
          existing.maxObserved.maxDepth = previous === null ? value : Math.max(previous, value)
        }

        if (message.ruleId === 'max-nested-callbacks') {
          const previous = existing.maxObserved.maxNestedCallbacks
          existing.maxObserved.maxNestedCallbacks =
            previous === null ? value : Math.max(previous, value)
        }
      }

      byFile.set(relativePath, existing)
    }
  }

  return byFile
}

export async function verifyRuleThreshold(cwd, file, ruleName, threshold) {
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: 'eslint.config.mjs',
    overrideConfig: {
      rules: {
        [ruleName]: ['error', threshold],
      },
    },
  })

  const [result] = await eslint.lintFiles([file])
  const scopedMessages = result.messages.filter((message) => message.ruleId === ruleName)

  let maxObserved = null
  for (const message of scopedMessages) {
    const value = parseRuleValue(ruleName, message.message)
    if (value === null) continue
    maxObserved = maxObserved === null ? value : Math.max(maxObserved, value)
  }

  return {
    ok: scopedMessages.length === 0,
    maxObserved,
  }
}
