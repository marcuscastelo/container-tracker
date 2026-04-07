import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const distRoot = path.join(repoRoot, 'dist', 'agent-control-ui')

function buildElectronEnv() {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  return env
}

const electron = spawn('pnpm', ['exec', 'electron', distRoot], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: buildElectronEnv(),
})

electron.once('error', (error) => {
  console.error(error)
  process.exit(1)
})

electron.once('exit', (code) => {
  process.exit(code ?? 0)
})
