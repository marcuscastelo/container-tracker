import path from 'node:path'
import tsParser from '@typescript-eslint/parser'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import { containerTrackerEslintPlugin } from '#container-tracker-eslint-plugin'

const noJsxTernaryRuleId = 'container-tracker/no-jsx-ternary'
const fixtureFilePath = path.join(
  'src',
  'modules',
  'process',
  'ui',
  'components',
  'NoJsxTernaryRuleFixture.tsx',
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
        [noJsxTernaryRuleId]: 'error',
      },
    },
  ],
})

async function lintWithNoJsxTernaryRule(source) {
  const [result] = await eslint.lintText(source, { filePath: fixtureFilePath })
  return result.messages.filter((message) => message.ruleId === noJsxTernaryRuleId)
}

const invalidCases = [
  {
    name: 'flags ternary with JSX in both branches',
    source: `
      const View = () => <div>{cond ? <A /> : <B />}</div>
    `,
  },
  {
    name: 'flags ternary with JSX consequent and null alternate',
    source: `
      const View = () => <div>{cond ? <A /> : null}</div>
    `,
  },
  {
    name: 'flags ternary with fragment consequent and JSX alternate',
    source: `
      const View = () => <div>{cond ? <><A /></> : <B />}</div>
    `,
  },
  {
    name: 'flags ternary with JSX consequent and fragment alternate',
    source: `
      const View = () => <div>{cond ? <A /> : <></>}</div>
    `,
  },
  {
    name: 'flags multiline ternary JSX',
    source: `
      const View = () => (
        <div>
          {cond
            ? <ComponentA />
            : <ComponentB />
          }
        </div>
      )
    `,
  },
  {
    name: 'flags ternary with TS wrappers around JSX branch',
    source: `
      const View = () => (
        <div>{cond ? ((<A /> satisfies JSX.Element) as JSX.Element)! : value}</div>
      )
    `,
  },
]

const validCases = [
  {
    name: 'allows ternary string literals',
    source: `
      const View = () => <div>{cond ? 'A' : 'B'}</div>
    `,
  },
  {
    name: 'allows ternary value expressions',
    source: `
      const View = () => <div>{cond ? valueA : valueB}</div>
    `,
  },
  {
    name: 'allows ternary numeric expressions',
    source: `
      const View = () => <div>{cond ? 1 : 2}</div>
    `,
  },
  {
    name: 'allows Show without fallback',
    source: `
      const View = () => (
        <Show when={cond}>
          <A />
        </Show>
      )
    `,
  },
  {
    name: 'allows Show with fallback',
    source: `
      const View = () => (
        <Show when={cond} fallback={<B />}>
          <A />
        </Show>
      )
    `,
  },
]

describe('container-tracker/no-jsx-ternary', () => {
  for (const testCase of invalidCases) {
    it(testCase.name, async () => {
      const messages = await lintWithNoJsxTernaryRule(testCase.source)
      expect(messages).toHaveLength(1)
      expect(messages[0]?.ruleId).toBe(noJsxTernaryRuleId)
      expect(messages[0]?.messageId).toBe('avoidJsxTernary')
    })
  }

  for (const testCase of validCases) {
    it(testCase.name, async () => {
      const messages = await lintWithNoJsxTernaryRule(testCase.source)
      expect(messages).toHaveLength(0)
    })
  }
})
