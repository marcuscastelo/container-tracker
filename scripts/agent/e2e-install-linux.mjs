#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const INSTALLER_TOKEN = 'installer-token-e2e'
const AGENT_TOKEN = 'agent-token-e2e'
const AGENT_ID = 'linux-e2e-agent'

const WINDOWS_INSTALL_ROOT = '%LOCALAPPDATA%\\Programs\\ContainerTrackerAgent'
const WINDOWS_DATA_ROOT = '%LOCALAPPDATA%\\ContainerTracker'

const WAIT_TIMEOUT_MS = 30_000

function toErrorMessage(error) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function resolveRepoRoot(startDir) {
  let cursor = startDir

  for (;;) {
    const marker = path.join(cursor, 'apps', 'agent', 'src', 'runtime', 'runtime.entry.ts')
    if (fsSync.existsSync(marker)) {
      return cursor
    }

    const parent = path.dirname(cursor)
    if (parent === cursor) {
      throw new Error('Could not resolve repository root from script location')
    }
    cursor = parent
  }
}

function updateEnvValue(content, key, value) {
  const pattern = new RegExp(`^${key}=.*$`, 'm')
  if (!pattern.test(content)) {
    throw new Error(`Missing key in bootstrap template: ${key}`)
  }

  return content.replace(pattern, `${key}=${value}`)
}

async function createMockServer() {
  const state = {
    enrollCalls: 0,
    targetsCalls: 0,
    ingestCalls: 0,
    lastTargetsAuth: '',
    lastAgentIdHeader: '',
  }

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')

    const collectBody = () =>
      new Promise((resolve, reject) => {
        const chunks = []
        request.on('data', (chunk) => {
          chunks.push(Buffer.from(chunk))
        })
        request.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          resolve(raw.length === 0 ? {} : JSON.parse(raw))
        })
        request.on('error', reject)
      })

    const sendJson = (status, payload) => {
      response.statusCode = status
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify(payload))
    }

    void (async () => {
      if (request.method === 'POST' && url.pathname === '/api/agent/enroll') {
        const auth = request.headers.authorization ?? ''
        if (auth !== `Bearer ${INSTALLER_TOKEN}`) {
          sendJson(401, { error: 'invalid_installer_token' })
          return
        }

        await collectBody()
        state.enrollCalls += 1
        sendJson(200, {
          agentToken: AGENT_TOKEN,
          tenantId: TENANT_ID,
          intervalSec: 3600,
          limit: 1,
          providers: {
            maerskEnabled: false,
            maerskHeadless: true,
            maerskTimeoutMs: 120000,
          },
        })
        return
      }

      if (request.method === 'GET' && url.pathname === '/api/agent/targets') {
        state.targetsCalls += 1
        state.lastTargetsAuth = request.headers.authorization ?? ''
        state.lastAgentIdHeader = request.headers['x-agent-id'] ?? ''

        if (state.lastTargetsAuth !== `Bearer ${AGENT_TOKEN}`) {
          sendJson(401, { error: 'invalid_agent_token' })
          return
        }

        if (url.searchParams.get('tenant_id') !== TENANT_ID) {
          sendJson(403, { error: 'tenant_mismatch' })
          return
        }

        sendJson(200, {
          targets: [],
          leased_until: null,
        })
        return
      }

      if (request.method === 'POST' && url.pathname === '/api/tracking/snapshots/ingest') {
        state.ingestCalls += 1
        await collectBody()
        sendJson(202, { ok: true, snapshot_id: randomUUID() })
        return
      }

      sendJson(404, { error: 'not_found' })
    })().catch((error) => {
      sendJson(500, { error: toErrorMessage(error) })
    })
  })

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve())
    server.on('error', reject)
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind mock server')
  }

  return {
    state,
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  }
}

async function waitForCondition(conditionFn, timeoutMs) {
  const started = Date.now()
  for (;;) {
    if (conditionFn()) {
      return
    }

    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out after ${timeoutMs}ms`)
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 100)
    })
  }
}

async function collectSandboxPaths(rootDir) {
  const collected = []
  const pending = [rootDir]

  while (pending.length > 0) {
    const currentDir = pending.pop()
    if (!currentDir) {
      continue
    }

    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name)
      collected.push(entryPath)

      if (entry.isDirectory()) {
        pending.push(entryPath)
      }
    }
  }

  return collected
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

async function stopChildProcess(child) {
  if (!child || child.exitCode !== null) {
    return
  }

  child.kill('SIGTERM')
  await new Promise((resolve) => {
    child.once('exit', () => resolve())
  })
}

async function runLinuxE2E() {
  if (process.platform === 'win32') {
    throw new Error('This script is intended to run on Linux/macOS only')
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = resolveRepoRoot(scriptDir)
  const bootstrapTemplatePath = path.join(
    repoRoot,
    'apps',
    'agent',
    'src',
    'installer',
    'bootstrap.env.template',
  )
  const compiledEntryPath = path.join(repoRoot, 'dist', 'apps', 'agent', 'src', 'agent.js')

  if (!fsSync.existsSync(compiledEntryPath)) {
    throw new Error('Missing compiled agent. Run "pnpm run agent:build" first.')
  }

  const sandboxRoot = process.env.AGENT_E2E_SANDBOX_DIR ?? '/tmp/container-tracker-agent-linux-e2e'
  const localAppDataRoot = path.join(sandboxRoot, 'LocalAppData')
  const installRoot = path.join(localAppDataRoot, 'Programs', 'ContainerTrackerAgent')
  const dataRoot = path.join(localAppDataRoot, 'ContainerTracker')

  await fs.rm(sandboxRoot, { recursive: true, force: true })
  await fs.mkdir(path.join(installRoot, 'app'), { recursive: true })
  await fs.mkdir(path.join(dataRoot, 'logs'), { recursive: true })
  await fs.mkdir(path.join(dataRoot, 'releases'), { recursive: true })
  await fs.mkdir(path.join(dataRoot, 'downloads'), { recursive: true })
  await fs.mkdir(path.join(dataRoot, 'run'), { recursive: true })

  const distSourcePath = path.join(repoRoot, 'dist')
  const distTargetPath = path.join(installRoot, 'app', 'dist')
  await fs.cp(distSourcePath, distTargetPath, { recursive: true })
  await fs.writeFile(
    path.join(distTargetPath, 'agent.js'),
    [
      '// Generated by Linux E2E installer simulation',
      "import './apps/agent/src/runtime/register-alias-loader.js'",
      "await import('./apps/agent/src/supervisor.js')",
      '',
    ].join('\n'),
    'utf8',
  )

  await fs.cp(path.join(repoRoot, 'package.json'), path.join(installRoot, 'app', 'package.json'))

  const sourceNodeModulesPath = path.join(repoRoot, 'node_modules')
  const targetNodeModulesPath = path.join(installRoot, 'app', 'node_modules')
  if (!fsSync.existsSync(sourceNodeModulesPath)) {
    throw new Error('Missing node_modules in repo root. Install dependencies first.')
  }
  await fs.symlink(sourceNodeModulesPath, targetNodeModulesPath, 'dir')

  const mappedEntrypointPath = path.join(installRoot, 'app', 'dist', 'agent.js')
  const mappedWorkingDirectory = path.join(installRoot, 'app')
  const mappedDotenvPath = path.join(dataRoot, 'config.env')
  const mappedBootstrapPath = path.join(dataRoot, 'bootstrap.env')
  const consumedBootstrapPath = `${mappedBootstrapPath}.consumed`

  const mockServer = await createMockServer()
  const outputLines = []
  let child = null

  try {
    let bootstrapTemplate = await fs.readFile(bootstrapTemplatePath, 'utf8')
    bootstrapTemplate = updateEnvValue(bootstrapTemplate, 'BACKEND_URL', mockServer.baseUrl)
    bootstrapTemplate = updateEnvValue(bootstrapTemplate, 'INSTALLER_TOKEN', INSTALLER_TOKEN)
    bootstrapTemplate = updateEnvValue(bootstrapTemplate, 'AGENT_ID', AGENT_ID)
    bootstrapTemplate = updateEnvValue(bootstrapTemplate, 'INTERVAL_SEC', '3600')
    bootstrapTemplate = updateEnvValue(bootstrapTemplate, 'LIMIT', '1')
    bootstrapTemplate = updateEnvValue(bootstrapTemplate, 'MAERSK_ENABLED', '0')
    await fs.writeFile(mappedBootstrapPath, bootstrapTemplate, 'utf8')

    child = spawn(process.execPath, [mappedEntrypointPath], {
      cwd: mappedWorkingDirectory,
      env: {
        ...process.env,
        LOCALAPPDATA: localAppDataRoot,
        DOTENV_PATH: mappedDotenvPath,
        BOOTSTRAP_DOTENV_PATH: mappedBootstrapPath,
        AGENT_MACHINE_GUID: 'linux-e2e-guid',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    child.stdout.on('data', (chunk) => {
      outputLines.push(chunk.toString('utf8'))
    })
    child.stderr.on('data', (chunk) => {
      outputLines.push(chunk.toString('utf8'))
    })

    await waitForCondition(() => {
      return (
        mockServer.state.enrollCalls >= 1 &&
        mockServer.state.targetsCalls >= 1 &&
        fsSync.existsSync(mappedDotenvPath) &&
        fsSync.existsSync(consumedBootstrapPath) &&
        !fsSync.existsSync(mappedBootstrapPath)
      )
    }, WAIT_TIMEOUT_MS)

    const consumedBootstrapContent = await fs.readFile(consumedBootstrapPath, 'utf8')
    if (consumedBootstrapContent.includes(INSTALLER_TOKEN)) {
      throw new Error('bootstrap.env.consumed leaked INSTALLER_TOKEN')
    }

    const generatedConfig = await fs.readFile(mappedDotenvPath, 'utf8')
    if (!generatedConfig.includes(`AGENT_TOKEN=${AGENT_TOKEN}`)) {
      throw new Error('config.env was not generated with runtime AGENT_TOKEN')
    }

    if (mockServer.state.lastTargetsAuth !== `Bearer ${AGENT_TOKEN}`) {
      throw new Error('targets endpoint did not receive runtime AGENT_TOKEN')
    }

    if (mockServer.state.lastAgentIdHeader !== AGENT_ID) {
      throw new Error('targets endpoint did not receive expected x-agent-id header')
    }

    const sandboxPaths = await collectSandboxPaths(sandboxRoot)
    const forbiddenPath = sandboxPaths.find((entryPath) =>
      entryPath.toLowerCase().includes('programdata'),
    )
    if (forbiddenPath) {
      throw new Error(`unexpected ProgramData path created in sandbox: ${forbiddenPath}`)
    }
  } catch (error) {
    throw new Error(`${toErrorMessage(error)}\nAgent output:\n${outputLines.join('')}`)
  } finally {
    await stopChildProcess(child)
    await closeServer(mockServer.server)
  }

  console.log('[agent:e2e:linux] PASS')
  console.log(`[agent:e2e:linux] sandbox=${sandboxRoot}`)
  console.log(`[agent:e2e:linux] windowsInstallRoot=${WINDOWS_INSTALL_ROOT}`)
  console.log(`[agent:e2e:linux] windowsDataRoot=${WINDOWS_DATA_ROOT}`)
  console.log(`[agent:e2e:linux] enrollCalls=${mockServer.state.enrollCalls}`)
  console.log(`[agent:e2e:linux] targetsCalls=${mockServer.state.targetsCalls}`)
  console.log(`[agent:e2e:linux] ingestCalls=${mockServer.state.ingestCalls}`)
}

void runLinuxE2E().catch((error) => {
  console.error(`[agent:e2e:linux] FAIL: ${toErrorMessage(error)}`)
  process.exit(1)
})
