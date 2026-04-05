import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const preloadSourcePath = path.join(repoRoot, 'tools', 'agent-control-ui', 'preload.cjs')
const preloadTargetPath = path.join(
  repoRoot,
  'dist',
  'agent-control-ui',
  'tools',
  'agent-control-ui',
  'preload.cjs',
)

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
