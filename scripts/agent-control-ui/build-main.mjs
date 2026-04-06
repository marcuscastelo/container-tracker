import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { rewriteEmittedImports } from './rewrite-emitted-imports.mjs'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const distRoot = path.join(repoRoot, 'dist', 'agent-control-ui')
const preloadSourcePath = path.join(repoRoot, 'tools', 'agent-control-ui', 'preload.cjs')
const preloadTargetPath = path.join(
  distRoot,
  'tools',
  'agent-control-ui',
  'preload.cjs',
)
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
  'tools/agent-control-ui/tsconfig.build.json',
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
      main: './tools/agent-control-ui/main.js',
    },
    null,
    2,
  )}\n`,
  'utf8',
)

rewriteEmittedImports({
  distRoot,
})
