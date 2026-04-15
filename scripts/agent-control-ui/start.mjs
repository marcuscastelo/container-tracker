import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const distRoot = path.join(repoRoot, 'dist', 'apps', 'agent', 'control-ui')

function buildElectronEnv() {
  const env = {
    ...process.env,
    CT_AGENT_UI_INSTALLED: '0',
  }
  delete env.ELECTRON_RUN_AS_NODE
  return env
}

function run(command, args, options = {}) {
  return spawn(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    ...options,
  })
}

function runAndWait(command, args, options = {}) {
  const child = run(command, args, options)
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => resolve(code ?? 1))
  })
}

function resolveSystemElectronBinary() {
  const candidates = [
    process.env.ELECTRON_BINARY,
    'electron',
    '/usr/bin/electron',
    '/usr/bin/electron22',
    '/usr/bin/electron23',
  ].filter((value) => typeof value === 'string' && value.length > 0)

  for (const candidate of candidates) {
    if (candidate.startsWith('/') && !fs.existsSync(candidate)) {
      continue
    }

    const probe = spawnSync(candidate, ['--version'], { stdio: 'ignore' })
    if (probe.status === 0) {
      return candidate
    }
  }

  return null
}

async function resolveElectronCommand() {
  const probeExit = await runAndWait('node', [
    '-e',
    "try{require('electron');process.exit(0)}catch{process.exit(1)}",
  ])
  if (probeExit === 0) {
    return {
      command: 'pnpm',
      args: ['exec', 'electron'],
    }
  }

  console.warn(
    '[agent-control-ui] electron runtime not found in node_modules; attempting `pnpm rebuild electron`',
  )
  const rebuildExit = await runAndWait('pnpm', ['rebuild', 'electron'])
  if (rebuildExit !== 0) {
    throw new Error(
      'Electron install is incomplete and automatic recovery failed. Run `pnpm rebuild electron` (or reinstall dependencies) and retry.',
    )
  }

  const reProbeExit = await runAndWait('node', [
    '-e',
    "try{require('electron');process.exit(0)}catch{process.exit(1)}",
  ])
  if (reProbeExit === 0) {
    return {
      command: 'pnpm',
      args: ['exec', 'electron'],
    }
  }

  const systemElectronBinary = resolveSystemElectronBinary()
  if (systemElectronBinary !== null) {
    console.warn(
      `[agent-control-ui] local electron package is unavailable; falling back to system electron binary at ${systemElectronBinary}`,
    )
    return {
      command: systemElectronBinary,
      args: [],
    }
  }

  throw new Error(
    'Electron install is still invalid after rebuild and no system `electron` binary was found. Delete `node_modules/.pnpm/electron@*` and run `pnpm install`.',
  )
}

let electronCommand
try {
  electronCommand = await resolveElectronCommand()
} catch (error) {
  console.error(error)
  process.exit(1)
}

const electron = run(electronCommand.command, [...electronCommand.args, distRoot], {
  env: buildElectronEnv(),
})

electron.once('error', (error) => {
  console.error(error)
  process.exit(1)
})

electron.once('exit', (code) => {
  process.exit(code ?? 0)
})
