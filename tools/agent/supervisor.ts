import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// biome-ignore lint/style/noRestrictedImports: Supervisor runtime resolves direct .ts imports for agent release execution.
import { appendPendingActivityEvents } from './pending-activity.ts'
// biome-ignore lint/style/noRestrictedImports: Supervisor runtime resolves direct .ts imports for agent release execution.
// biome-ignore lint/performance/noNamespaceImport: Supervisor runtime keeps grouped release-manager symbols for resilient formatting.
import * as releaseManager from './release-manager.ts'
// biome-ignore lint/style/noRestrictedImports: Supervisor runtime resolves direct .ts imports for agent release execution.
import { readReleaseState, withRecordedFailure, writeReleaseState } from './release-state.ts'
// biome-ignore lint/style/noRestrictedImports: Supervisor runtime resolves direct .ts imports for agent release execution.
import { readRuntimeHealth } from './runtime-health.ts'
// biome-ignore lint/style/noRestrictedImports: Supervisor runtime resolves direct .ts imports for agent release execution.
import { ensureAgentPathLayout, resolveAgentPathLayout } from './runtime-paths.ts'
// biome-ignore lint/style/noRestrictedImports: Supervisor runtime resolves direct .ts imports for agent release execution.
import { clearSupervisorControl } from './supervisor-control.ts'

const EXIT_CODE_RESTART_FOR_UPDATE = 42
const DEFAULT_STARTUP_TIMEOUT_MS = 30_000
const DEFAULT_STABILITY_WINDOW_MS = 120_000
const DEFAULT_CRASH_LOOP_WINDOW_MS = 5 * 60 * 1000
const DEFAULT_CRASH_LOOP_THRESHOLD = 3
const RESTART_BACKOFF_MS = 2_000
const HEALTH_POLL_INTERVAL_MS = 500

type ChildRunOutcome = {
  readonly exitCode: number | null
  readonly startupConfirmed: boolean
  readonly startupTimedOut: boolean
  readonly stabilityConfirmed: boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function normalizeOptionalEnv(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

function resolveNumberEnv(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

function resolveFallbackRuntimeEntrypoint(scriptDir: string): string {
  const candidates = [
    path.resolve(scriptDir, 'agent.js'),
    path.resolve(scriptDir, 'agent.ts'),
    path.resolve(scriptDir, '../dist/tools/agent/agent.js'),
    path.resolve(scriptDir, '../../tools/agent/dist/tools/agent/agent.js'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate
    }
  }

  throw new Error('could not resolve fallback runtime entrypoint for supervisor')
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
  const packagePath = findPackageJsonPath(startDir)
  if (!packagePath) {
    return 'unknown'
  }

  try {
    const raw = fs.readFileSync(packagePath, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'version' in parsed &&
      typeof parsed.version === 'string' &&
      parsed.version.trim().length > 0
    ) {
      return parsed.version.trim()
    }
  } catch {
    // fallback below
  }

  return 'unknown'
}

function selectRollbackVersion(command: {
  readonly releasesDir: string
  readonly lastKnownGoodVersion: string
  readonly previousVersion: string | null
  readonly fallbackVersion: string
}): string {
  const candidates = [
    command.lastKnownGoodVersion,
    command.previousVersion,
    command.fallbackVersion,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

  for (const version of candidates) {
    const releaseDir = releaseManager.resolveReleaseDir(command.releasesDir, version)
    if (fs.existsSync(releaseDir)) {
      return version
    }
  }

  return command.fallbackVersion
}

async function runChildWithHealthGate(command: {
  readonly scriptPath: string
  readonly expectedVersion: string
  readonly startupTimeoutMs: number
  readonly stabilityWindowMs: number
  readonly healthPath: string
  readonly env: NodeJS.ProcessEnv
  readonly onStabilityConfirmed: () => void
}): Promise<ChildRunOutcome> {
  const child = spawn(process.execPath, [command.scriptPath], {
    env: command.env,
    stdio: 'inherit',
    shell: false,
  })

  let childExited = false
  let startupConfirmed = false
  let startupTimedOut = false
  let stabilityConfirmed = false
  let onStabilityConfirmedCalled = false

  const exitPromise = new Promise<number | null>((resolve) => {
    child.once('exit', (code) => {
      childExited = true
      resolve(code)
    })
  })

  const monitorPromise = (async (): Promise<void> => {
    const startupDeadlineMs = Date.now() + command.startupTimeoutMs
    while (!childExited && Date.now() < startupDeadlineMs) {
      const health = readRuntimeHealth(command.healthPath)
      if (
        health &&
        health.boot_status === 'healthy' &&
        health.agent_version === command.expectedVersion &&
        typeof health.last_heartbeat_ok_at === 'string'
      ) {
        startupConfirmed = true
        break
      }
      await sleep(HEALTH_POLL_INTERVAL_MS)
    }

    if (!startupConfirmed && !childExited) {
      startupTimedOut = true
      child.kill('SIGTERM')
      return
    }

    if (!startupConfirmed) {
      return
    }

    const stabilityDeadlineMs = Date.now() + command.stabilityWindowMs
    while (!childExited && Date.now() < stabilityDeadlineMs) {
      await sleep(HEALTH_POLL_INTERVAL_MS)
    }

    if (!childExited) {
      stabilityConfirmed = true
      if (!onStabilityConfirmedCalled) {
        onStabilityConfirmedCalled = true
        command.onStabilityConfirmed()
      }
    }
  })()

  const exitCode = await exitPromise
  await monitorPromise

  return {
    exitCode,
    startupConfirmed,
    startupTimedOut,
    stabilityConfirmed,
  }
}

async function runChildWithoutHealthGate(command: {
  readonly scriptPath: string
  readonly env: NodeJS.ProcessEnv
}): Promise<ChildRunOutcome> {
  const child = spawn(process.execPath, [command.scriptPath], {
    env: command.env,
    stdio: 'inherit',
    shell: false,
  })

  const exitCode = await new Promise<number | null>((resolve) => {
    child.once('exit', (code) => {
      resolve(code)
    })
  })

  return {
    exitCode,
    startupConfirmed: false,
    startupTimedOut: false,
    stabilityConfirmed: false,
  }
}

async function main(): Promise<void> {
  const scriptPath = fileURLToPath(import.meta.url)
  const scriptDir = path.dirname(scriptPath)
  const fallbackEntrypoint = resolveFallbackRuntimeEntrypoint(scriptDir)
  const fallbackVersion = readAgentVersion(scriptDir)

  const startupTimeoutMs = resolveNumberEnv(
    normalizeOptionalEnv(process.env.AGENT_UPDATE_STARTUP_TIMEOUT_MS),
    DEFAULT_STARTUP_TIMEOUT_MS,
  )
  const stabilityWindowMs = resolveNumberEnv(
    normalizeOptionalEnv(process.env.AGENT_UPDATE_STABILITY_WINDOW_MS),
    DEFAULT_STABILITY_WINDOW_MS,
  )
  const crashLoopWindowMs = resolveNumberEnv(
    normalizeOptionalEnv(process.env.AGENT_UPDATE_CRASH_LOOP_WINDOW_MS),
    DEFAULT_CRASH_LOOP_WINDOW_MS,
  )
  const crashLoopThreshold = resolveNumberEnv(
    normalizeOptionalEnv(process.env.AGENT_UPDATE_CRASH_LOOP_THRESHOLD),
    DEFAULT_CRASH_LOOP_THRESHOLD,
  )

  const layout = resolveAgentPathLayout()
  ensureAgentPathLayout(layout)
  clearSupervisorControl(layout.supervisorControlPath)

  let shuttingDown = false
  process.once('SIGINT', () => {
    shuttingDown = true
  })
  process.once('SIGTERM', () => {
    shuttingDown = true
  })

  for (;;) {
    if (shuttingDown) {
      break
    }

    let state = readReleaseState(layout.releaseStatePath, fallbackVersion)
    releaseManager.ensureReleaseLinksForCurrentState({ layout, state })

    const nowIso = new Date().toISOString()

    if (state.activation_state === 'pending' && state.target_version) {
      try {
        state = releaseManager.activateTargetRelease({
          layout,
          state,
          targetVersion: state.target_version,
          nowIso,
        })
        writeReleaseState(layout.releaseStatePath, state)
        appendPendingActivityEvents(layout.pendingActivityPath, [
          {
            type: 'UPDATE_APPLY_STARTED',
            message: `Supervisor started activation for version ${state.current_version}`,
            severity: 'info',
            metadata: { version: state.current_version },
            occurred_at: nowIso,
          },
        ])
      } catch (error) {
        const errorMessage = toErrorMessage(error)
        const rollbackVersion = selectRollbackVersion({
          releasesDir: layout.releasesDir,
          lastKnownGoodVersion: state.last_known_good_version,
          previousVersion: state.previous_version,
          fallbackVersion,
        })
        state = releaseManager.rollbackRelease({
          layout,
          state,
          rollbackVersion,
          nowIso,
          reason: `failed to activate pending release: ${errorMessage}`,
          crashLoopDetected: false,
        })
        writeReleaseState(layout.releaseStatePath, state)
        appendPendingActivityEvents(layout.pendingActivityPath, [
          {
            type: 'UPDATE_APPLY_FAILED',
            message: `Failed to activate pending release: ${errorMessage}`,
            severity: 'danger',
            metadata: { targetVersion: state.target_version },
            occurred_at: nowIso,
          },
          {
            type: 'ROLLBACK_EXECUTED',
            message: `Rollback executed to ${rollbackVersion}`,
            severity: 'warning',
            metadata: { rollbackVersion },
            occurred_at: nowIso,
          },
        ])
      }
    }

    state = readReleaseState(layout.releaseStatePath, fallbackVersion)
    const runtimeSelection = releaseManager.resolveRuntimeEntrypoint({
      layout,
      fallbackEntrypoint,
      expectedVersion: state.current_version,
    })

    clearSupervisorControl(layout.supervisorControlPath)

    const requireHealthGate =
      state.activation_state === 'verifying' &&
      state.target_version !== null &&
      state.current_version === state.target_version

    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      AGENT_SUPERVISOR_HEALTH_PATH: layout.runtimeHealthPath,
      AGENT_SUPERVISOR_CONTROL_PATH: layout.supervisorControlPath,
      AGENT_PENDING_ACTIVITY_PATH: layout.pendingActivityPath,
      AGENT_ACTIVE_RELEASE_VERSION: runtimeSelection.version,
    }

    const runResult = requireHealthGate
      ? await runChildWithHealthGate({
          scriptPath: runtimeSelection.entrypointPath,
          expectedVersion: runtimeSelection.version,
          startupTimeoutMs,
          stabilityWindowMs,
          healthPath: layout.runtimeHealthPath,
          env: childEnv,
          onStabilityConfirmed() {
            const currentState = readReleaseState(layout.releaseStatePath, fallbackVersion)
            if (!currentState.target_version) {
              return
            }

            const confirmedState = releaseManager.confirmRelease({
              state: currentState,
              confirmedVersion: currentState.target_version,
              nowIso: new Date().toISOString(),
            })
            writeReleaseState(layout.releaseStatePath, confirmedState)
          },
        })
      : await runChildWithoutHealthGate({
          scriptPath: runtimeSelection.entrypointPath,
          env: childEnv,
        })

    if (shuttingDown) {
      break
    }

    const refreshedState = readReleaseState(layout.releaseStatePath, fallbackVersion)

    if (runResult.exitCode === EXIT_CODE_RESTART_FOR_UPDATE) {
      await sleep(1_000)
      continue
    }

    const shouldRollbackFromHealthGate =
      requireHealthGate &&
      (!runResult.startupConfirmed ||
        runResult.startupTimedOut ||
        (runResult.startupConfirmed && !runResult.stabilityConfirmed))

    if (shouldRollbackFromHealthGate && refreshedState.target_version) {
      const failureReason = runResult.startupTimedOut
        ? `startup timeout for version ${refreshedState.target_version}`
        : `unstable runtime for version ${refreshedState.target_version}`

      const failureTracked = withRecordedFailure({
        state: refreshedState,
        version: refreshedState.target_version,
        nowIso: new Date().toISOString(),
        crashLoopWindowMs,
        crashLoopThreshold,
      })

      const rollbackVersion = selectRollbackVersion({
        releasesDir: layout.releasesDir,
        lastKnownGoodVersion: refreshedState.last_known_good_version,
        previousVersion: refreshedState.previous_version,
        fallbackVersion,
      })

      const rolledBackState = releaseManager.rollbackRelease({
        layout,
        state: failureTracked.nextState,
        rollbackVersion,
        nowIso: new Date().toISOString(),
        reason: failureReason,
        crashLoopDetected: failureTracked.isCrashLoop,
      })

      writeReleaseState(layout.releaseStatePath, rolledBackState)
      appendPendingActivityEvents(layout.pendingActivityPath, [
        {
          type: 'UPDATE_APPLY_FAILED',
          message: failureReason,
          severity: 'danger',
          metadata: {
            version: refreshedState.target_version,
            crashLoopDetected: failureTracked.isCrashLoop,
          },
          occurred_at: new Date().toISOString(),
        },
        {
          type: 'ROLLBACK_EXECUTED',
          message: `Rollback executed to ${rollbackVersion}`,
          severity: 'warning',
          metadata: {
            rollbackVersion,
            crashLoopDetected: failureTracked.isCrashLoop,
          },
          occurred_at: new Date().toISOString(),
        },
      ])
      await sleep(RESTART_BACKOFF_MS)
      continue
    }

    if (runResult.exitCode === 0) {
      break
    }

    await sleep(RESTART_BACKOFF_MS)
  }
}

void main().catch((error) => {
  console.error(`[supervisor] fatal error: ${toErrorMessage(error)}`)
  process.exitCode = 1
})
