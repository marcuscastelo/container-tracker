import { describe, expect, it } from 'vitest'
import {
  assertNoIifeErrorSmokeResult,
  noIifeErrorSmokeConstants,
} from '../eslint-plugin/no-iife-in-jsx-error-smoke.shared.mjs'

const { noIifeRuleId, noIifeRuleMessageId } = noIifeErrorSmokeConstants

function buildResult(messages, status = 1) {
  return {
    status,
    stdout: JSON.stringify([
      {
        filePath: '/tmp/NoIifeErrorSmokeFixture.tsx',
        messages,
        errorCount: messages.length,
        warningCount: 0,
        fatalErrorCount: 0,
      },
    ]),
    stderr: '',
  }
}

describe('assertNoIifeErrorSmokeResult', () => {
  it('passes when eslint exits with a concrete no-iife rule violation', () => {
    const result = buildResult([
      {
        ruleId: noIifeRuleId,
        messageId: noIifeRuleMessageId,
        severity: noIifeErrorSmokeConstants.noIifeErrorSeverity,
        message: 'Avoid IIFE inside JSX.',
      },
    ])

    expect(() => assertNoIifeErrorSmokeResult(result)).not.toThrow()
  })

  it('fails when eslint exits with status 2 despite containing rule text in stderr', () => {
    const result = {
      status: 2,
      stdout: '',
      stderr: `A configuration object specifies rule "${noIifeRuleId}"`,
    }

    expect(() => assertNoIifeErrorSmokeResult(result)).toThrow(
      'Expected ESLint to exit with status 1',
    )
  })

  it('fails when eslint status is 1 but output does not include concrete rule messageId', () => {
    const result = buildResult([
      {
        ruleId: noIifeRuleId,
        severity: 2,
        message: `Definition for rule '${noIifeRuleId}' was not found.`,
      },
    ])

    expect(() => assertNoIifeErrorSmokeResult(result)).toThrow(
      `Expected ${noIifeRuleId} with messageId ${noIifeRuleMessageId}`,
    )
  })

  it('fails when matching rule is reported only as warning severity', () => {
    const result = buildResult([
      {
        ruleId: noIifeRuleId,
        messageId: noIifeRuleMessageId,
        severity: 1,
        message: 'Avoid IIFE inside JSX.',
      },
    ])

    expect(() => assertNoIifeErrorSmokeResult(result)).toThrow(
      `Expected ${noIifeRuleId} with messageId ${noIifeRuleMessageId} at severity ${String(noIifeErrorSmokeConstants.noIifeErrorSeverity)}`,
    )
  })
})
