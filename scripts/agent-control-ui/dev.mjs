import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer } from 'vite'
import { createAgentControlUiViteConfig } from './vite-shared.mjs'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const distRoot = path.join(repoRoot, 'dist', 'apps', 'agent', 'control-ui')
const fallbackRendererUrl = process.env.AGENT_CONTROL_UI_RENDERER_URL ?? 'http://127.0.0.1:4310'

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

function buildElectronEnv(rendererUrl) {
  const env = {
    ...process.env,
    AGENT_CONTROL_UI_RENDERER_URL: rendererUrl,
  }
  delete env.ELECTRON_RUN_AS_NODE
  return env
}

async function waitForUrl(url, timeoutMs = 30000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return
      }
    } catch {
      // Vite may still be booting.
    }

    await delay(500)
  }

  throw new Error(`Timed out waiting for renderer at ${url}`)
}

async function main() {
  const electronCommand = await resolveElectronCommand()

  const build = run('node', ['scripts/agent-control-ui/build-main.mjs'])
  const buildExitCode = await new Promise((resolve, reject) => {
    build.once('error', reject)
    build.once('exit', (code) => resolve(code ?? 1))
  })

  if (buildExitCode !== 0) {
    process.exit(buildExitCode)
  }

  console.log('[agent-control-ui] built Electron main/preload')

  const vite = await createServer(createAgentControlUiViteConfig())
  await vite.listen()
  const rendererUrl = vite.resolvedUrls?.local[0] ?? fallbackRendererUrl
  console.log(`[agent-control-ui] renderer available at ${rendererUrl}`)

  let cleanedUp = false
  const cleanup = async () => {
    if (cleanedUp) return
    cleanedUp = true
    await vite.close()
  }

  process.on('SIGINT', () => {
    void cleanup()
  })
  process.on('SIGTERM', () => {
    void cleanup()
  })

  try {
    await waitForUrl(rendererUrl)
  } catch (error) {
    await cleanup()
    throw error
  }

  const electron = run(electronCommand.command, [...electronCommand.args, distRoot], {
    env: buildElectronEnv(rendererUrl),
  })
  console.log('[agent-control-ui] launching Electron shell')

  const electronExitCode = await new Promise((resolve, reject) => {
    electron.once('error', reject)
    electron.once('exit', (code) => resolve(code ?? 0))
  })

  await cleanup()
  process.exit(electronExitCode)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
