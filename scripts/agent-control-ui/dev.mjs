import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { createServer } from 'vite'
import { createAgentControlUiViteConfig } from './vite-shared.mjs'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const distRoot = path.join(repoRoot, 'dist', 'agent-control-ui')
const mainEntryPath = path.join(distRoot, 'tools', 'agent-control-ui', 'main.js')
const aliasRegisterPath = pathToFileURL(
  path.join(repoRoot, 'scripts', 'agent-control-ui', 'register-alias-loader.mjs'),
).href
const fallbackRendererUrl = process.env.AGENT_CONTROL_UI_RENDERER_URL ?? 'http://127.0.0.1:4310'

function run(command, args, options = {}) {
  return spawn(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    ...options,
  })
}

function buildNodeOptions() {
  const loaderOption = `--import=${aliasRegisterPath}`
  const current = process.env.NODE_OPTIONS?.trim()
  return current ? `${current} ${loaderOption}` : loaderOption
}

function buildElectronEnv(rendererUrl) {
  const env = {
    ...process.env,
    AGENT_CONTROL_UI_RENDERER_URL: rendererUrl,
    NODE_OPTIONS: buildNodeOptions(),
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

  const electron = run('pnpm', ['exec', 'electron', mainEntryPath], {
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
