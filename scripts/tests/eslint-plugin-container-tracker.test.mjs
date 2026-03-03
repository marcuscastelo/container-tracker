import path from 'node:path'
import tsParser from '@typescript-eslint/parser'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import { containerTrackerEslintPlugin } from '#container-tracker-eslint-plugin'

const noIifeInJsxRuleId = 'container-tracker/no-iife-in-jsx'
const fixtureFilePath = path.join(
  'src',
  'modules',
  'process',
  'ui',
  'components',
  'NoIifeRuleFixture.tsx',
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
        [noIifeInJsxRuleId]: 'error',
      },
    },
  ],
})

async function lintWithNoIifeRule(source) {
  const [result] = await eslint.lintText(source, { filePath: fixtureFilePath })
  return result.messages.filter((message) => message.ruleId === noIifeInJsxRuleId)
}

const invalidCases = [
  {
    name: 'flags arrow IIFE inside For',
    source: `
      const View = () => (
        <For each={[1, 2]}>
          {(item) => <span>{(() => item)()}</span>}
        </For>
      )
    `,
  },
  {
    name: 'flags function expression IIFE inside Show',
    source: `
      const View = () => (
        <Show when={true}>
          {(function () { return 'visible' })()}
        </Show>
      )
    `,
  },
  {
    name: 'flags arrow IIFE inside Switch',
    source: `
      const View = () => (
        <Switch>
          {(() => 'fallback')()}
        </Switch>
      )
    `,
  },
  {
    name: 'flags function expression IIFE inside Match',
    source: `
      const View = () => (
        <Match when={true}>
          {(function () { return 'matched' })()}
        </Match>
      )
    `,
  },
  {
    name: 'flags arrow IIFE inside Index',
    source: `
      const View = () => (
        <Index each={[1, 2]}>
          {(item) => <span>{(() => item())()}</span>}
        </Index>
      )
    `,
  },
]

const validCases = [
  {
    name: 'allows pre-calculation outside JSX expression containers',
    source: `
      const value = (() => 42)()
      const View = () => <div>{value}</div>
    `,
  },
  {
    name: 'allows createMemo usage inside JSX',
    source: `
      import { createMemo } from 'solid-js'

      const View = () => {
        const label = createMemo(() => 'ready')
        return <Show when={true}>{label()}</Show>
      }
    `,
  },
  {
    name: 'allows pure external function calls inside JSX',
    source: `
      const toLabel = (value) => \`item-\${value}\`
      const View = () => (
        <For each={[1, 2]}>
          {(value) => <span>{toLabel(value)}</span>}
        </For>
      )
    `,
  },
]

describe('container-tracker/no-iife-in-jsx', () => {
  for (const testCase of invalidCases) {
    it(testCase.name, async () => {
      const messages = await lintWithNoIifeRule(testCase.source)
      expect(messages).toHaveLength(1)
      expect(messages[0]?.ruleId).toBe(noIifeInJsxRuleId)
      expect(messages[0]?.messageId).toBe('avoidIifeInJsx')
    })
  }

  for (const testCase of validCases) {
    it(testCase.name, async () => {
      const messages = await lintWithNoIifeRule(testCase.source)
      expect(messages).toHaveLength(0)
    })
  }

  it('does not report IIFE outside JSX expression containers', async () => {
    const messages = await lintWithNoIifeRule(`
      const value = (function () { return 'ok' })()
      const View = () => <div>{value}</div>
    `)

    expect(messages).toHaveLength(0)
  })
})
