import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const distRoot = path.join(repoRoot, 'dist', 'agent-control-ui')
const mainEntryPath = path.join(distRoot, 'tools', 'agent-control-ui', 'main.js')
const aliasRegisterPath = pathToFileURL(
  path.join(repoRoot, 'scripts', 'agent-control-ui', 'register-alias-loader.mjs'),
).href

function buildNodeOptions() {
  const loaderOption = `--import=${aliasRegisterPath}`
  const current = process.env.NODE_OPTIONS?.trim()
  return current ? `${current} ${loaderOption}` : loaderOption
}

function buildElectronEnv() {
  const env = {
    ...process.env,
    NODE_OPTIONS: buildNodeOptions(),
  }
  delete env.ELECTRON_RUN_AS_NODE
  return env
}

const electron = spawn('pnpm', ['exec', 'electron', mainEntryPath], {
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
