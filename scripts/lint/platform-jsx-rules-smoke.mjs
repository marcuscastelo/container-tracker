import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'

const currentFilePath = fileURLToPath(import.meta.url)
const scriptsDirectory = path.dirname(currentFilePath)
const repositoryRoot = path.resolve(scriptsDirectory, '..', '..')
const smokeFixtureDirectory = path.join(
  repositoryRoot,
  'src',
  'modules',
  'process',
  'ui',
  '__lint_smoke_platform_jsx__',
)
const smokeFixtureFilePath = path.join(smokeFixtureDirectory, 'PlatformJsxRulesSmokeFixture.tsx')

const smokeFixtureSource = `export function PlatformJsxRulesSmokeFixture() {
  return (
    <div>
      {true && <span>short</span>}
      {true ? <span>left</span> : <span>right</span>}
      {(() => 'iife')()}
    </div>
  )
}
`

const expectedRules = new Map([
  ['platform/no-iife-in-jsx', 'avoidIifeInJsx'],
  ['platform/no-jsx-short-circuit', 'avoidJsxShortCircuit'],
  ['platform/no-jsx-ternary', 'avoidJsxTernary'],
])

function summarizeMessages(messages) {
  return messages.map((message) => ({
    ruleId: message?.ruleId ?? null,
    messageId: message?.messageId ?? null,
    severity: message?.severity ?? null,
  }))
}

function collectPlatformViolations(results) {
  const violations = new Map()

  for (const result of results) {
    const messages = Array.isArray(result?.messages) ? result.messages : []

    for (const message of messages) {
      const ruleId = message?.ruleId
      if (!expectedRules.has(ruleId)) {
        continue
      }

      const previous = violations.get(ruleId) ?? []
      previous.push(message)
      violations.set(ruleId, previous)
    }
  }

  return violations
}

function assertPlatformJsxRulesSmokeResult(results) {
  if (!Array.isArray(results)) {
    throw new Error(
      `Expected ESLint results to be an array.\nObserved value:\n${JSON.stringify(results, null, 2)}`,
    )
  }

  const hasErrorResult = results.some(
    (result) =>
      typeof result?.errorCount === 'number' &&
      result.errorCount > 0 &&
      Array.isArray(result?.messages) &&
      result.messages.length > 0,
  )

  if (!hasErrorResult) {
    throw new Error(
      `Expected ESLint to report errors because the smoke fixture contains JSX rule violations.\nObserved results:\n${JSON.stringify(results, null, 2)}`,
    )
  }

  const violationsByRule = collectPlatformViolations(results)

  for (const [ruleId, messageId] of expectedRules) {
    const violations = violationsByRule.get(ruleId) ?? []

    const hasExpectedViolation = violations.some(
      (message) => message?.messageId === messageId && message?.severity === 2,
    )

    if (!hasExpectedViolation) {
      const diagnostics = results.flatMap((result) =>
        summarizeMessages(Array.isArray(result?.messages) ? result.messages : []),
      )

      throw new Error(
        `Expected ${ruleId} to report messageId ${messageId} at severity 2.\nObserved diagnostics:\n${JSON.stringify(diagnostics, null, 2)}`,
      )
    }
  }
}

async function runSmokeCheck() {
  await mkdir(smokeFixtureDirectory, { recursive: true })

  try {
    await writeFile(smokeFixtureFilePath, smokeFixtureSource, 'utf8')

    const eslint = new ESLint({
      cwd: repositoryRoot,
      overrideConfigFile: 'eslint.config.mjs',
      overrideConfig: {
        rules: {
          'platform/no-iife-in-jsx': 'error',
        },
      },
    })

    const results = await eslint.lintFiles([smokeFixtureFilePath])
    assertPlatformJsxRulesSmokeResult(results)

    console.log('[platform-jsx-rules-smoke] PASS')
  } finally {
    await rm(smokeFixtureDirectory, { recursive: true, force: true })
  }
}

runSmokeCheck().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[platform-jsx-rules-smoke] FAIL')
  console.error(message)
  process.exitCode = 1
})
