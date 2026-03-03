import { spawnSync } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { assertNoIifeErrorSmokeResult } from './no-iife-in-jsx-error-smoke.shared.mjs'

const currentFilePath = fileURLToPath(import.meta.url)
const scriptsDirectory = path.dirname(currentFilePath)
const repositoryRoot = path.resolve(scriptsDirectory, '..')
const eslintCliPath = path.join(repositoryRoot, 'node_modules', 'eslint', 'bin', 'eslint.js')
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
      process.execPath,
      [
        eslintCliPath,
        smokeFixtureFilePath,
        '--rule',
        'container-tracker/no-iife-in-jsx:error',
        '--format',
        'json',
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

    assertNoIifeErrorSmokeResult(command)

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
