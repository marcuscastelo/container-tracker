import { spawnSync } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const currentFilePath = fileURLToPath(import.meta.url)
const scriptsDirectory = path.dirname(currentFilePath)
const repositoryRoot = path.resolve(scriptsDirectory, '..')
const smokeFixtureDirectory = path.join(
  repositoryRoot,
  'src',
  'modules',
  'process',
  'ui',
  '__lint_smoke_no_iife__',
)
const smokeFixtureFilePath = path.join(smokeFixtureDirectory, 'NoIifeErrorSmokeFixture.tsx')

const smokeFixtureSource = `import { For } from 'solid-js'

export function NoIifeErrorSmokeFixture() {
  return (
    <For each={[1, 2]}>
      {(item) => <span>{(() => item)()}</span>}
    </For>
  )
}
`

async function runSmokeCheck() {
  await mkdir(smokeFixtureDirectory, { recursive: true })

  try {
    await writeFile(smokeFixtureFilePath, smokeFixtureSource, 'utf8')

    const command = spawnSync(
      'pnpm',
      [
        'exec',
        'eslint',
        smokeFixtureFilePath,
        '--rule',
        'container-tracker/no-iife-in-jsx:error',
        '--max-warnings=0',
      ],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
      },
    )

    if (command.error) {
      throw command.error
    }

    const output = `${command.stdout ?? ''}\n${command.stderr ?? ''}`
    const detectedRuleViolation = output.includes('container-tracker/no-iife-in-jsx')

    if (command.status === 0) {
      throw new Error(
        'Expected ESLint to fail when no-iife-in-jsx is promoted to error, but command succeeded.',
      )
    }

    if (!detectedRuleViolation) {
      throw new Error(
        'ESLint failed for an unexpected reason. Expected container-tracker/no-iife-in-jsx violation.',
      )
    }

    console.log('[no-iife-in-jsx-error-smoke] PASS')
  } finally {
    await rm(smokeFixtureDirectory, { recursive: true, force: true })
  }
}

runSmokeCheck().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[no-iife-in-jsx-error-smoke] FAIL')
  console.error(message)
  process.exitCode = 1
})
