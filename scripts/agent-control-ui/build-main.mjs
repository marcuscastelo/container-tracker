import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { rewriteEmittedImports } from './rewrite-emitted-imports.mjs'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const distRoot = path.join(repoRoot, 'dist', 'apps', 'agent', 'control-ui')
const preloadSourcePath = path.join(repoRoot, 'apps', 'agent', 'src', 'electron', 'preload.cjs')
const preloadTargetPath = path.join(distRoot, 'apps', 'agent', 'src', 'electron', 'preload.cjs')
const electronManifestPath = path.join(distRoot, 'package.json')

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: 'inherit',
    })

    child.once('error', reject)
    child.once('exit', (code) => {
      resolve(code ?? 1)
    })
  })
}

const exitCode = await run('pnpm', [
  'exec',
  'tsc',
  '-p',
  'apps/agent/tsconfig.control-ui.build.json',
])
if (exitCode !== 0) {
  process.exit(exitCode)
}

await fs.mkdir(path.dirname(preloadTargetPath), { recursive: true })
await fs.copyFile(preloadSourcePath, preloadTargetPath)
await fs.writeFile(
  electronManifestPath,
  `${JSON.stringify(
    {
      name: 'container-tracker-agent-control-ui',
      private: true,
      type: 'module',
      main: './apps/agent/src/electron/main.js',
    },
    null,
    2,
  )}\n`,
  'utf8',
)

rewriteEmittedImports({
  distRoot,
})
