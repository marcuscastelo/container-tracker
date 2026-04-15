import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readRuntimeConfigFromEnv } from '@agent/config/infrastructure/env-config.repository'
import { refreshAgentControlPublicLogs } from '@agent/control-core/public-control-files'
import { appendPendingActivityEvents } from '@agent/pending-activity'
import { runReleaseCheckCycle } from '@agent/release/application/check-for-update'
import { EXIT_FATAL, EXIT_OK } from '@agent/runtime/lifecycle-exit-codes'
import type { AgentPathLayout } from '@agent/runtime-paths'
import { ensureAgentPathLayout, resolveAgentPathLayout } from '@agent/runtime-paths'
import { requestRuntimeDrain } from '@agent/runtime/application/drain-runtime'

const MAX_LOG_FILE_SIZE_BYTES = 10 * 1024 * 1024
const PUBLIC_LOG_REFRESH_DEBOUNCE_MS = 150

export type UpdaterPublicLogsPublisher = {
  readonly requestRefresh: () => void
  readonly flushPending: () => void
}

let publicLogsPublisher: UpdaterPublicLogsPublisher | null = null

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function resolveLogPath(layout: AgentPathLayout): string {
  return path.join(layout.logsDir, 'updater.log')
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

export function createUpdaterPublicLogsPublisher(command: {
  readonly refresh: () => void
  readonly debounceMs?: number
}): UpdaterPublicLogsPublisher {
  let timer: NodeJS.Timeout | null = null
  const debounceMs = command.debounceMs ?? PUBLIC_LOG_REFRESH_DEBOUNCE_MS

  return {
    requestRefresh() {
      if (timer) {
        return
      }

      timer = setTimeout(() => {
        timer = null
        command.refresh()
      }, debounceMs)
      timer.unref?.()
    },
    flushPending() {
      if (!timer) {
        return
      }

      clearTimeout(timer)
      timer = null
      command.refresh()
    },
  }
}

function getPublicLogsPublisher(layout: AgentPathLayout): UpdaterPublicLogsPublisher {
  if (publicLogsPublisher) {
    return publicLogsPublisher
  }

  publicLogsPublisher = createUpdaterPublicLogsPublisher({
    refresh() {
      try {
        refreshAgentControlPublicLogs({
          filePath: layout.publicLogsPath,
          layout,
        })
      } catch (error) {
        console.warn(`[updater] failed to refresh public control logs: ${toErrorMessage(error)}`)
      }
    },
  })

  return publicLogsPublisher
}

function flushPendingPublicLogs(): void {
  publicLogsPublisher?.flushPending()
}

function appendLogLine(layout: AgentPathLayout, message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`
  console.log(line)

  const logPath = resolveLogPath(layout)
  const logDir = path.dirname(logPath)
  fs.mkdirSync(logDir, { recursive: true })
  rotateLogIfNeeded(logPath)
  fs.appendFileSync(logPath, `${line}\n`, 'utf8')
  getPublicLogsPublisher(layout).requestRefresh()
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

function readConfigFromLayout(layout: AgentPathLayout): {
  readonly backendUrl: string
  readonly agentToken: string
  readonly agentId: string
  readonly updateChannel: string
} {
  const config = readRuntimeConfigFromEnv({
    paths: layout,
  })
  if (!config) {
    throw new Error(`config.env not found at ${layout.configEnvPath}`)
  }

  return {
    backendUrl: config.BACKEND_URL,
    agentToken: config.AGENT_TOKEN,
    agentId: config.AGENT_ID,
    updateChannel: config.AGENT_UPDATE_MANIFEST_CHANNEL,
  }
}

async function runUpdater(): Promise<void> {
  const scriptPath = fileURLToPath(import.meta.url)
  const scriptDir = path.dirname(scriptPath)

  const layout = resolveAgentPathLayout()
  ensureAgentPathLayout(layout)
  const config = readConfigFromLayout(layout)
  const runningVersion = readAgentVersion(scriptDir)

  appendLogLine(layout, `[updater] version=${runningVersion}`)

  const result = await runReleaseCheckCycle({
    layout,
    fallbackVersion: runningVersion,
    backendUrl: config.backendUrl,
    agentToken: config.agentToken,
    agentId: config.agentId,
    updateChannel: config.updateChannel,
  })

  if (result.activities.length > 0) {
    appendPendingActivityEvents(layout.pendingActivityPath, result.activities)
  }

  if (result.shouldDrain && result.drainReason) {
    requestRuntimeDrain({
      supervisorControlPath: layout.supervisorControlPath,
      reason: result.drainReason,
      requestedAt: new Date().toISOString(),
    })
    appendLogLine(layout, `[updater] drain requested (${result.drainReason})`)
  }

  if (!result.updateAvailable) {
    appendLogLine(layout, '[updater] no update available')
    return
  }

  appendLogLine(layout, `[updater] processed manifest version ${result.manifestVersion}`)
}

export async function runUpdaterMain(): Promise<void> {
  try {
    await runUpdater()
    flushPendingPublicLogs()
    process.exit(EXIT_OK)
  } catch (error) {
    const layout = resolveAgentPathLayout()
    ensureAgentPathLayout(layout)
    appendLogLine(layout, `[updater] failed: ${toErrorMessage(error)}`)
    flushPendingPublicLogs()
    process.exit(EXIT_FATAL)
  }
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1]
  if (!entrypoint) {
    return false
  }

  try {
    return path.resolve(entrypoint) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
}

if (isMainModule()) {
  void runUpdaterMain()
}
