import path from 'node:path'
import tsParser from '@typescript-eslint/parser'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import { containerTrackerEslintPlugin } from '#container-tracker-eslint-plugin'

const noJsxShortCircuitRuleId = 'container-tracker/no-jsx-short-circuit'
const fixtureFilePath = path.join(
  'src',
  'modules',
  'process',
  'ui',
  'components',
  'NoJsxShortCircuitRuleFixture.tsx',
)

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.{ts,tsx}'],
      languageOptions: {
        parser: tsParser,
        parserOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
      plugins: {
        'container-tracker': containerTrackerEslintPlugin,
      },
      rules: {
        [noJsxShortCircuitRuleId]: 'error',
      },
    },
  ],
})

async function lintWithNoJsxShortCircuitRule(source) {
  const [result] = await eslint.lintText(source, { filePath: fixtureFilePath })
  return result.messages.filter((message) => message.ruleId === noJsxShortCircuitRuleId)
}

const invalidCases = [
  {
    name: 'flags simple short-circuit with JSX element',
    source: `
      const View = () => <div>{cond && <A />}</div>
    `,
  },
  {
    name: 'flags short-circuit with JSX fragment',
    source: `
      const View = () => <div>{cond && <><A /></>}</div>
    `,
  },
  {
    name: 'flags short-circuit with JSX conditional expression',
    source: `
      const View = () => <div>{cond && (foo ? <A /> : <B />)}</div>
    `,
  },
  {
    name: 'flags nested logical chain ending in JSX',
    source: `
      const View = () => <div>{a && (b && <A />)}</div>
    `,
  },
  {
    name: 'flags JSX with TS wrappers after unwrapping',
    source: `
      const View = () => <div>{cond && ((<A /> satisfies JSX.Element) as JSX.Element)!}</div>
    `,
  },
]

const validCases = [
  {
    name: 'allows short-circuit with string literal',
    source: `
      const View = () => <div>{cond && 'x'}</div>
    `,
  },
  {
    name: 'allows short-circuit with variable value',
    source: `
      const someValue = 'ready'
      const View = () => <div>{cond && someValue}</div>
    `,
  },
  {
    name: 'allows optional chaining call result',
    source: `
      const foo = { bar: () => 'ok' }
      const View = () => <div>{cond && foo?.bar()}</div>
    `,
  },
  {
    name: 'allows function expression that returns JSX (not explicit JSX in right branch)',
    source: `
      const View = () => <div>{cond && (() => <A />)}</div>
    `,
  },
  {
    name: 'allows logical expression outside JSXExpressionContainer',
    source: `
      const someValue = 1
      const maybe = cond && someValue
      const View = () => <div>{maybe}</div>
    `,
  },
  {
    name: 'allows Show when usage',
    source: `
      const View = () => (
        <Show when={cond}>
          <A />
        </Show>
      )
    `,
  },
]

describe('container-tracker/no-jsx-short-circuit', () => {
  for (const testCase of invalidCases) {
    it(testCase.name, async () => {
      const messages = await lintWithNoJsxShortCircuitRule(testCase.source)
      expect(messages).toHaveLength(1)
      expect(messages[0]?.ruleId).toBe(noJsxShortCircuitRuleId)
      expect(messages[0]?.messageId).toBe('avoidJsxShortCircuit')
    })
  }

  for (const testCase of validCases) {
    it(testCase.name, async () => {
      const messages = await lintWithNoJsxShortCircuitRule(testCase.source)
      expect(messages).toHaveLength(0)
    })
  }
})
