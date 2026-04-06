import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { refreshAgentControlPublicLogs } from './control-core/public-control-files.ts'
// biome-ignore lint/style/noRestrictedImports: Updater runtime resolves direct .ts imports for staged releases.
import { appendPendingActivityEvents } from './pending-activity.ts'
// biome-ignore lint/style/noRestrictedImports: Updater runtime resolves direct .ts imports for staged releases.
import { resolveAgentPlatformKey } from './platform/platform.adapter.ts'
// biome-ignore lint/style/noRestrictedImports: Updater runtime resolves direct .ts imports for staged releases.
import { readReleaseState, writeReleaseState } from './release-state.ts'
// biome-ignore lint/style/noRestrictedImports: Updater runtime resolves direct .ts imports for staged releases.
import { EXIT_FATAL, EXIT_OK } from './runtime/lifecycle-exit-codes.ts'
import { resolveAgentPublicLogsPath } from './runtime/paths.ts'
// biome-ignore lint/style/noRestrictedImports: Updater runtime resolves direct .ts imports for staged releases.
import type { AgentPathLayout } from './runtime-paths.ts'
// biome-ignore lint/style/noRestrictedImports: Updater runtime resolves direct .ts imports for staged releases.
import { ensureAgentPathLayout, resolveAgentPathLayout } from './runtime-paths.ts'
// biome-ignore lint/style/noRestrictedImports: Updater runtime resolves direct .ts imports for staged releases.
import { writeSupervisorControl } from './supervisor-control.ts'
// biome-ignore lint/style/noRestrictedImports: Updater runtime resolves direct .ts imports for staged releases.
import { fetchUpdateManifest, stageReleaseFromManifest } from './updater.core.ts'

const MAX_LOG_FILE_SIZE_BYTES = 10 * 1024 * 1024

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function resolveDotenvPath(layout: AgentPathLayout): string {
  const fromEnv = process.env.DOTENV_PATH?.trim()
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv
  }

  return layout.configPath
}

function resolveLogPath(layout: AgentPathLayout): string {
  return path.join(layout.logsDir, 'updater.log')
}

function unquoteValue(value: string): string {
  if (value.length < 2) return value
  const first = value.at(0)
  const last = value.at(-1)
  if (!first || !last) return value

  if ((first === "'" && last === "'") || (first === '"' && last === '"')) {
    return value.slice(1, -1)
  }

  return value
}

function parseEnvLine(line: string): { readonly key: string; readonly value: string } | null {
  const trimmed = line.trim()
  if (trimmed.length === 0 || trimmed.startsWith('#')) return null

  const separatorIndex = trimmed.indexOf('=')
  if (separatorIndex <= 0) return null

  const key = trimmed.slice(0, separatorIndex).trim()
  const rawValue = trimmed.slice(separatorIndex + 1).trim()
  if (key.length === 0) return null

  return {
    key,
    value: unquoteValue(rawValue),
  }
}

function readConfigFromEnvFile(filePath: string): {
  readonly backendUrl: string
  readonly agentToken: string
  readonly agentId: string
} {
  if (!fs.existsSync(filePath)) {
    throw new Error(`DOTENV_PATH file not found: ${filePath}`)
  }

  const raw = fs.readFileSync(filePath, 'utf8')
  const values = new Map<string, string>()
  for (const line of raw.split(/\r?\n/u)) {
    const parsed = parseEnvLine(line)
    if (!parsed) continue
    values.set(parsed.key, parsed.value)
  }

  const backendUrl = values.get('BACKEND_URL')?.trim() ?? ''
  const agentToken = values.get('AGENT_TOKEN')?.trim() ?? ''
  const agentId = values.get('AGENT_ID')?.trim() ?? os.hostname()

  if (backendUrl.length === 0 || agentToken.length === 0) {
    throw new Error('config.env must define BACKEND_URL and AGENT_TOKEN for updater execution')
  }

  return {
    backendUrl: backendUrl.replace(/\/+$/u, ''),
    agentToken,
    agentId: agentId.length > 0 ? agentId : os.hostname(),
  }
}

function rotateLogIfNeeded(logPath: string): void {
  if (!fs.existsSync(logPath)) {
    return
  }

  const stat = fs.statSync(logPath)
  if (stat.size <= MAX_LOG_FILE_SIZE_BYTES) {
    return
  }

  const rotationPath = `${logPath}.1`
  if (fs.existsSync(rotationPath)) {
    fs.rmSync(rotationPath)
  }

  fs.renameSync(logPath, rotationPath)
}

function appendLogLine(layout: AgentPathLayout, message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`
  console.log(line)

  const logPath = resolveLogPath(layout)
  const logDir = path.dirname(logPath)
  fs.mkdirSync(logDir, { recursive: true })
  rotateLogIfNeeded(logPath)
  fs.appendFileSync(logPath, `${line}\n`, 'utf8')

  if (process.platform === 'linux') {
    try {
      refreshAgentControlPublicLogs({
        filePath: resolveAgentPublicLogsPath(),
        layout,
      })
    } catch (error) {
      console.warn(`[updater] failed to refresh public control logs: ${toErrorMessage(error)}`)
    }
  }
}

function findPackageJsonPath(startDir: string): string | null {
  let current = startDir

  for (;;) {
    const candidate = path.join(current, 'package.json')
    if (fs.existsSync(candidate)) {
      return candidate
    }

    const parent = path.dirname(current)
    if (parent === current) {
      return null
    }

    current = parent
  }
}

function readAgentVersion(startDir: string): string {
  const packageJsonPath = findPackageJsonPath(startDir)
  if (!packageJsonPath) {
    return 'unknown'
  }

  try {
    const raw = fs.readFileSync(packageJsonPath, 'utf8')
    const parsed: unknown = JSON.parse(raw)

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'version' in parsed &&
      typeof parsed.version === 'string'
    ) {
      return parsed.version
    }
  } catch {
    // handled by fallback below
  }

  return 'unknown'
}

async function runUpdater(): Promise<void> {
  const scriptPath = fileURLToPath(import.meta.url)
  const scriptDir = path.dirname(scriptPath)

  const layout = resolveAgentPathLayout()
  ensureAgentPathLayout(layout)
  const dotenvPath = resolveDotenvPath(layout)
  const config = readConfigFromEnvFile(dotenvPath)
  const runningVersion = readAgentVersion(scriptDir)
  const nowIso = new Date().toISOString()

  let releaseState = readReleaseState(layout.releaseStatePath, runningVersion)
  appendLogLine(layout, `[updater] version=${runningVersion}`)
  appendLogLine(layout, `[updater] state=${releaseState.activation_state}`)

  const manifest = await fetchUpdateManifest({
    backendUrl: config.backendUrl,
    agentToken: config.agentToken,
    agentId: config.agentId,
    platform: resolveAgentPlatformKey(),
  })

  appendPendingActivityEvents(layout.pendingActivityPath, [
    {
      type: 'UPDATE_CHECKED',
      message: `Checked update manifest (desired=${manifest.desired_version ?? 'none'})`,
      severity: 'info',
      metadata: {
        version: manifest.version,
        updateAvailable: manifest.update_available,
      },
      occurred_at: nowIso,
    },
  ])

  const staged = await stageReleaseFromManifest({
    manifest,
    layout,
    state: releaseState,
  })

  if (staged.kind === 'no_update') {
    appendLogLine(layout, '[updater] no update available')
    return
  }

  if (staged.kind === 'blocked') {
    releaseState = {
      ...releaseState,
      activation_state: 'idle',
      last_error: staged.reason,
      last_update_attempt: nowIso,
      automatic_updates_blocked: releaseState.automatic_updates_blocked,
    }
    writeReleaseState(layout.releaseStatePath, releaseState)
    appendPendingActivityEvents(layout.pendingActivityPath, [
      {
        type: 'UPDATE_APPLY_FAILED',
        message: staged.reason,
        severity: 'danger',
        metadata: {
          version: staged.manifest.version,
        },
        occurred_at: nowIso,
      },
    ])
    appendLogLine(layout, `[updater] skipping blocked version: ${staged.reason}`)
    return
  }

  appendPendingActivityEvents(layout.pendingActivityPath, [
    {
      type: 'UPDATE_AVAILABLE',
      message: `Update available: ${staged.manifest.version}`,
      severity: 'info',
      metadata: {
        version: staged.manifest.version,
        channel: staged.manifest.channel,
      },
      occurred_at: nowIso,
    },
  ])

  if (staged.downloaded) {
    appendPendingActivityEvents(layout.pendingActivityPath, [
      {
        type: 'UPDATE_DOWNLOAD_STARTED',
        message: `Downloading release ${staged.manifest.version}`,
        severity: 'info',
        metadata: {
          version: staged.manifest.version,
          url: staged.manifest.download_url,
        },
        occurred_at: nowIso,
      },
      {
        type: 'UPDATE_DOWNLOAD_COMPLETED',
        message: `Downloaded release ${staged.manifest.version}`,
        severity: 'success',
        metadata: {
          version: staged.manifest.version,
          checksum: staged.manifest.checksum,
        },
        occurred_at: nowIso,
      },
    ])
  }

  releaseState = {
    ...releaseState,
    target_version: staged.manifest.version,
    activation_state: 'pending',
    last_update_attempt: nowIso,
    last_error: null,
    automatic_updates_blocked: false,
  }
  writeReleaseState(layout.releaseStatePath, releaseState)

  writeSupervisorControl(layout.supervisorControlPath, {
    drain_requested: true,
    reason: 'update',
    requested_at: nowIso,
  })

  appendPendingActivityEvents(layout.pendingActivityPath, [
    {
      type: 'UPDATE_READY',
      message: `Release ${staged.manifest.version} is staged and pending activation`,
      severity: 'success',
      metadata: {
        version: staged.manifest.version,
        releaseDir: staged.releaseDir,
      },
      occurred_at: nowIso,
    },
  ])

  appendLogLine(layout, `[updater] staged version ${staged.manifest.version}`)
}

async function main(): Promise<void> {
  try {
    await runUpdater()
    process.exit(EXIT_OK)
  } catch (error) {
    const layout = resolveAgentPathLayout()
    ensureAgentPathLayout(layout)
    appendLogLine(layout, `[updater] failed: ${toErrorMessage(error)}`)
    process.exit(EXIT_FATAL)
  }
}

void main()
