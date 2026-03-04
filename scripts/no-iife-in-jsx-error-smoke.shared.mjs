const noIifeRuleId = 'container-tracker/no-iife-in-jsx'
const noIifeRuleMessageId = 'avoidIifeInJsx'
const noIifeErrorSeverity = 2
const maximumDiagnosticsLength = 1200

function truncateText(text) {
  if (text.length <= maximumDiagnosticsLength) {
    return text
  }

  return `${text.slice(0, maximumDiagnosticsLength)}...`
}

function buildDiagnosticsContext(stdout, stderr) {
  const normalizedStdout = stdout.trim()
  const normalizedStderr = stderr.trim()

  if (normalizedStdout.length === 0 && normalizedStderr.length === 0) {
    return ''
  }

  const diagnostics = [
    '[no-iife-in-jsx-error-smoke] ESLint diagnostics:',
    `stdout:\n${truncateText(normalizedStdout || '<empty>')}`,
    `stderr:\n${truncateText(normalizedStderr || '<empty>')}`,
  ]

  return `\n${diagnostics.join('\n')}`
}

function parseJsonResults(stdout, stderr) {
  const normalizedStdout = stdout.trim()

  if (normalizedStdout.length === 0) {
    throw new Error(
      `Expected ESLint JSON output, but stdout was empty.${buildDiagnosticsContext(stdout, stderr)}`,
    )
  }

  let parsedOutput
  try {
    parsedOutput = JSON.parse(normalizedStdout)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Failed to parse ESLint JSON output: ${message}.${buildDiagnosticsContext(stdout, stderr)}`,
    )
  }

  if (!Array.isArray(parsedOutput)) {
    throw new Error(
      `Expected ESLint JSON output to be an array.${buildDiagnosticsContext(stdout, stderr)}`,
    )
  }

  return parsedOutput
}

function collectNoIifeViolations(results) {
  const violations = []
  for (const result of results) {
    const messages = Array.isArray(result?.messages) ? result.messages : []

    for (const message of messages) {
      if (message?.ruleId !== noIifeRuleId) {
        continue
      }

      if (message?.messageId !== noIifeRuleMessageId) {
        continue
      }

      if (message?.severity !== noIifeErrorSeverity) {
        continue
      }

      violations.push(message)
    }
  }

  return violations
}

export function assertNoIifeErrorSmokeResult(commandResult) {
  const status = commandResult?.status
  const stdout = commandResult?.stdout ?? ''
  const stderr = commandResult?.stderr ?? ''

  if (status === 0) {
    throw new Error(
      'Expected ESLint to fail when no-iife-in-jsx is promoted to error, but command succeeded.',
    )
  }

  if (status !== 1) {
    throw new Error(
      `Expected ESLint to exit with status 1 (lint violations). Received: ${String(status)}.${buildDiagnosticsContext(stdout, stderr)}`,
    )
  }

  const results = parseJsonResults(stdout, stderr)
  const violations = collectNoIifeViolations(results)

  if (violations.length === 0) {
    throw new Error(
      `ESLint failed for an unexpected reason. Expected ${noIifeRuleId} with messageId ${noIifeRuleMessageId} at severity ${String(noIifeErrorSeverity)}.${buildDiagnosticsContext(stdout, stderr)}`,
    )
  }
}

export const noIifeErrorSmokeConstants = {
  noIifeErrorSeverity,
  noIifeRuleId,
  noIifeRuleMessageId,
}
