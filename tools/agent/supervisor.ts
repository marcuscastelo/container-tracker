#!/usr/bin/env node

// biome-ignore-all lint/style/noRestrictedImports: Supervisor runtime resolves direct .ts imports for agent release execution.
import type { ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { appendPendingActivityEvents } from './pending-activity.ts'
import { resolvePlatformAdapter } from './platform/platform.adapter.ts'
// biome-ignore lint/performance/noNamespaceImport: Supervisor runtime keeps grouped release-manager symbols for resilient formatting.
import * as releaseManager from './release-manager.ts'
import { readReleaseState, withRecordedFailure, writeReleaseState } from './release-state.ts'
import {
  EXIT_CONFIG_ERROR,
  EXIT_FATAL,
  EXIT_OK,
  resolveSupervisorExitAction,
} from './runtime/lifecycle-exit-codes.ts'
import { readRuntimeHealth } from './runtime-health.ts'
import { ensureAgentPathLayout, resolveAgentPathLayout } from './runtime-paths.ts'
import { clearSupervisorControl } from './supervisor-control.ts'

const DEFAULT_STARTUP_TIMEOUT_MS = 30_000
const DEFAULT_HEALTH_GRACE_MS = 120_000
const DEFAULT_CRASH_LOOP_WINDOW_MS = 5 * 60 * 1000
const DEFAULT_CRASH_LOOP_THRESHOLD = 3
const DEFAULT_MAX_ACTIVATION_FAILURES = 5
const RESTART_BACKOFF_MS = 2_000
const HEALTH_POLL_INTERVAL_MS = 500
const MAX_SUPERVISOR_LOG_FILE_SIZE_BYTES = 10 * 1024 * 1024
const MAX_RUNTIME_STDIO_LOG_FILE_SIZE_BYTES = 20 * 1024 * 1024
const RUNTIME_STDIO_ROTATION_CHECK_INTERVAL_MS = 2000

type ChildRunOutcome = {
  readonly exitCode: number | null
  readonly startupConfirmed: boolean
  readonly startupTimedOut: boolean
  readonly healthGraceConfirmed: boolean
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

function rotateLogIfNeeded(logPath: string, maxSizeBytes: number): void {
  if (!fs.existsSync(logPath)) {
    return
  }

  const stat = fs.statSync(logPath)
  if (stat.size <= maxSizeBytes) {
    return
  }

  const rotationPath = `${logPath}.1`
  if (fs.existsSync(rotationPath)) {
    fs.rmSync(rotationPath, { force: true })
  }

  fs.renameSync(logPath, rotationPath)
}

function appendSupervisorLog(logsDir: string, message: string): void {
  const line = `[${new Date().toISOString()}] [supervisor] ${message}`
  console.log(line)

  const logPath = path.join(logsDir, 'supervisor.log')
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  rotateLogIfNeeded(logPath, MAX_SUPERVISOR_LOG_FILE_SIZE_BYTES)
  fs.appendFileSync(logPath, `${line}\n`, 'utf8')
}

function isErrorCode(command: { readonly code: string; readonly error: unknown }): boolean {
  const error = command.error
  if (typeof error !== 'object' || error === null) return false
  const code = Reflect.get(error, 'code')
  return code === command.code
}

type RotatingChunkWriter = {
  write: (chunk: Buffer | string) => void
  close: () => Promise<void>
}

function createRotatingChunkWriter(command: {
  readonly logPath: string
  readonly maxSizeBytes: number
}): RotatingChunkWriter {
  fs.mkdirSync(path.dirname(command.logPath), { recursive: true })

  let stream = fs.createWriteStream(command.logPath, { flags: 'a' })
  let closed = false
  let rotating = false
  let buffer: (Buffer | string)[] = []

  const closeStream = async (): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      stream.end(() => resolve())
      stream.once('error', reject)
    })
  }

  const flushBuffer = (): void => {
    const pending = buffer
    buffer = []
    for (const chunk of pending) {
      stream.write(chunk)
    }
  }

  const rotate = async (): Promise<void> => {
    if (closed || rotating) return
    rotating = true

    try {
      await closeStream()

      const rotationPath = `${command.logPath}.1`
      await fs.promises.rm(rotationPath, { force: true }).catch(() => undefined)
      await fs.promises.rename(command.logPath, rotationPath).catch(() => undefined)

      stream = fs.createWriteStream(command.logPath, { flags: 'a' })
      flushBuffer()
    } finally {
      rotating = false
    }
  }

  const checkHandle = setInterval(() => {
    void (async () => {
      if (closed || rotating) return
      try {
        const stat = await fs.promises.stat(command.logPath)
        if (stat.size <= command.maxSizeBytes) return
        await rotate()
      } catch (error) {
        if (isErrorCode({ code: 'ENOENT', error })) {
          return
        }
      }
    })()
  }, RUNTIME_STDIO_ROTATION_CHECK_INTERVAL_MS)

  return {
    write(chunk) {
      if (closed) return
      if (rotating) {
        buffer.push(chunk)
        return
      }
      stream.write(chunk)
    },
    async close() {
      if (closed) return
      closed = true
      clearInterval(checkHandle)
      await closeStream()
    },
  }
}

function mirrorRuntimeOutput(command: {
  readonly child: ChildProcess
  readonly logsDir: string
}): void {
  const stdout = command.child.stdout
  if (stdout) {
    const stdoutLogPath = path.join(command.logsDir, 'agent.out.log')
    const stdoutWriter = createRotatingChunkWriter({
      logPath: stdoutLogPath,
      maxSizeBytes: MAX_RUNTIME_STDIO_LOG_FILE_SIZE_BYTES,
    })
    stdout.on('data', (chunk: Buffer | string) => {
      process.stdout.write(chunk)
      stdoutWriter.write(chunk)
    })
    command.child.once('exit', () => {
      void stdoutWriter.close()
    })
  }

  const stderr = command.child.stderr
  if (stderr) {
    const stderrLogPath = path.join(command.logsDir, 'agent.err.log')
    const stderrWriter = createRotatingChunkWriter({
      logPath: stderrLogPath,
      maxSizeBytes: MAX_RUNTIME_STDIO_LOG_FILE_SIZE_BYTES,
    })
    stderr.on('data', (chunk: Buffer | string) => {
      process.stderr.write(chunk)
      stderrWriter.write(chunk)
    })
    command.child.once('exit', () => {
      void stderrWriter.close()
    })
  }
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
  readonly healthGraceMs: number
  readonly healthPath: string
  readonly env: NodeJS.ProcessEnv
  readonly logsDir: string
  readonly onStabilityConfirmed: () => void
}): Promise<ChildRunOutcome> {
  const platformAdapter = resolvePlatformAdapter()
  const child = platformAdapter.startRuntime({
    scriptPath: command.scriptPath,
    env: command.env,
    stdio: 'pipe',
  })
  mirrorRuntimeOutput({
    child,
    logsDir: command.logsDir,
  })
  appendSupervisorLog(
    command.logsDir,
    `started runtime pid=${child.pid ?? 'unknown'} version=${command.expectedVersion} entrypoint=${command.scriptPath}`,
  )

  let childExited = false
  let startupConfirmed = false
  let startupTimedOut = false
  let healthGraceConfirmed = false
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
      platformAdapter.stopRuntime({ child })
      return
    }

    if (!startupConfirmed) {
      return
    }

    const healthGraceDeadlineMs = Date.now() + command.healthGraceMs
    while (!childExited && Date.now() < healthGraceDeadlineMs) {
      await sleep(HEALTH_POLL_INTERVAL_MS)
    }

    if (!childExited) {
      healthGraceConfirmed = true
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
    healthGraceConfirmed,
  }
}

async function runChildWithoutHealthGate(command: {
  readonly scriptPath: string
  readonly env: NodeJS.ProcessEnv
  readonly logsDir: string
  readonly version: string
}): Promise<ChildRunOutcome> {
  const platformAdapter = resolvePlatformAdapter()
  const child = platformAdapter.startRuntime({
    scriptPath: command.scriptPath,
    env: command.env,
    stdio: 'pipe',
  })
  mirrorRuntimeOutput({
    child,
    logsDir: command.logsDir,
  })
  appendSupervisorLog(
    command.logsDir,
    `started runtime pid=${child.pid ?? 'unknown'} version=${command.version} entrypoint=${command.scriptPath}`,
  )

  const exitCode = await new Promise<number | null>((resolve) => {
    child.once('exit', (code) => {
      resolve(code)
    })
  })

  return {
    exitCode,
    startupConfirmed: false,
    startupTimedOut: false,
    healthGraceConfirmed: false,
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
  const HEALTH_GRACE_MS = resolveNumberEnv(
    normalizeOptionalEnv(process.env.AGENT_UPDATE_HEALTH_GRACE_MS) ??
      normalizeOptionalEnv(process.env.AGENT_UPDATE_STABILITY_WINDOW_MS),
    DEFAULT_HEALTH_GRACE_MS,
  )
  const crashLoopWindowMs = resolveNumberEnv(
    normalizeOptionalEnv(process.env.AGENT_UPDATE_CRASH_LOOP_WINDOW_MS),
    DEFAULT_CRASH_LOOP_WINDOW_MS,
  )
  const crashLoopThreshold = resolveNumberEnv(
    normalizeOptionalEnv(process.env.AGENT_UPDATE_CRASH_LOOP_THRESHOLD),
    DEFAULT_CRASH_LOOP_THRESHOLD,
  )
  const MAX_ACTIVATION_FAILURES = resolveNumberEnv(
    normalizeOptionalEnv(process.env.AGENT_UPDATE_MAX_ACTIVATION_FAILURES),
    DEFAULT_MAX_ACTIVATION_FAILURES,
  )

  const layout = resolveAgentPathLayout()
  ensureAgentPathLayout(layout)
  clearSupervisorControl(layout.supervisorControlPath)
  appendSupervisorLog(layout.logsDir, 'supervisor started')

  let shuttingDown = false
  let supervisorExitCode = EXIT_OK
  let consecutiveReleaseRuntimeFailures = 0
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
        const targetVersion = state.target_version
        state = releaseManager.activateTargetRelease({
          layout,
          state,
          targetVersion,
          nowIso,
        })
        writeReleaseState(layout.releaseStatePath, state)
        appendSupervisorLog(layout.logsDir, `activation started for version=${targetVersion}`)
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
        const failedTargetVersion = state.target_version
        const failureTracked =
          failedTargetVersion === null
            ? null
            : withRecordedFailure({
                state,
                version: failedTargetVersion,
                nowIso: new Date().toISOString(),
                crashLoopWindowMs,
                crashLoopThreshold,
                maxActivationFailures: MAX_ACTIVATION_FAILURES,
              })
        if (failureTracked?.newlyBlocked && failedTargetVersion) {
          appendSupervisorLog(
            layout.logsDir,
            `[update] version ${failedTargetVersion} blocked after ${failureTracked.activationFailuresForVersion} activation failures`,
          )
        }
        const rollbackVersion = selectRollbackVersion({
          releasesDir: layout.releasesDir,
          lastKnownGoodVersion: state.last_known_good_version,
          previousVersion: state.previous_version,
          fallbackVersion,
        })
        state = releaseManager.rollbackRelease({
          layout,
          state: failureTracked?.nextState ?? state,
          rollbackVersion,
          nowIso,
          reason: `failed to activate pending release: ${errorMessage}`,
        })
        writeReleaseState(layout.releaseStatePath, state)
        appendSupervisorLog(
          layout.logsDir,
          `activation failed target=${failedTargetVersion ?? 'unknown'} rollback=${rollbackVersion} error="${errorMessage}"`,
        )
        appendPendingActivityEvents(layout.pendingActivityPath, [
          {
            type: 'UPDATE_APPLY_FAILED',
            message: `Failed to activate pending release: ${errorMessage}`,
            severity: 'danger',
            metadata: {
              targetVersion: failedTargetVersion,
              activationFailures: failureTracked?.activationFailuresForVersion ?? 0,
              crashLoopDetected: failureTracked?.isCrashLoop ?? false,
            },
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
    appendSupervisorLog(
      layout.logsDir,
      `runtime selected source=${runtimeSelection.source} version=${runtimeSelection.version} entrypoint=${runtimeSelection.entrypointPath} activation_state=${state.activation_state}`,
    )

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
          healthGraceMs: HEALTH_GRACE_MS,
          healthPath: layout.runtimeHealthPath,
          env: childEnv,
          logsDir: layout.logsDir,
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
            appendSupervisorLog(
              layout.logsDir,
              `activation confirmed for version=${currentState.target_version}`,
            )
          },
        })
      : await runChildWithoutHealthGate({
          scriptPath: runtimeSelection.entrypointPath,
          env: childEnv,
          logsDir: layout.logsDir,
          version: runtimeSelection.version,
        })

    if (shuttingDown) {
      break
    }

    const refreshedState = readReleaseState(layout.releaseStatePath, fallbackVersion)
    const exitAction = resolveSupervisorExitAction(runResult.exitCode)
    if (exitAction === 'restart-for-update') {
      consecutiveReleaseRuntimeFailures = 0
      await sleep(1_000)
      continue
    }

    const failedReleaseRuntimeWithoutHealthGate =
      !requireHealthGate && runtimeSelection.source === 'release' && runResult.exitCode !== 0

    if (failedReleaseRuntimeWithoutHealthGate) {
      consecutiveReleaseRuntimeFailures += 1
    } else {
      consecutiveReleaseRuntimeFailures = 0
    }

    const shouldRollbackFromHealthGate =
      requireHealthGate &&
      (!runResult.startupConfirmed ||
        runResult.startupTimedOut ||
        (runResult.startupConfirmed && !runResult.healthGraceConfirmed))

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
        maxActivationFailures: MAX_ACTIVATION_FAILURES,
      })
      if (failureTracked.newlyBlocked) {
        appendSupervisorLog(
          layout.logsDir,
          `[update] version ${refreshedState.target_version} blocked after ${failureTracked.activationFailuresForVersion} activation failures`,
        )
      }

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
      })

      writeReleaseState(layout.releaseStatePath, rolledBackState)
      consecutiveReleaseRuntimeFailures = 0
      appendSupervisorLog(
        layout.logsDir,
        `rollback executed to ${rollbackVersion} after health gate failure (target=${refreshedState.target_version})`,
      )
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

    if (failedReleaseRuntimeWithoutHealthGate) {
      appendSupervisorLog(
        layout.logsDir,
        `release runtime failure count=${consecutiveReleaseRuntimeFailures}/${crashLoopThreshold} version=${runtimeSelection.version}`,
      )
    }

    const shouldFallbackAfterReleaseCrashLoop =
      failedReleaseRuntimeWithoutHealthGate &&
      consecutiveReleaseRuntimeFailures >= crashLoopThreshold

    if (shouldFallbackAfterReleaseCrashLoop) {
      const now = new Date().toISOString()
      const failureTracked = withRecordedFailure({
        state: refreshedState,
        version: runtimeSelection.version,
        nowIso: now,
        crashLoopWindowMs,
        crashLoopThreshold,
        maxActivationFailures: MAX_ACTIVATION_FAILURES,
      })
      if (failureTracked.newlyBlocked) {
        appendSupervisorLog(
          layout.logsDir,
          `[update] version ${runtimeSelection.version} blocked after ${failureTracked.activationFailuresForVersion} activation failures`,
        )
      }

      const fallbackState = releaseManager.rollbackRelease({
        layout,
        state: failureTracked.nextState,
        rollbackVersion: fallbackVersion,
        nowIso: now,
        reason: `release crash loop detected for version ${runtimeSelection.version}; switching to fallback runtime`,
      })

      writeReleaseState(layout.releaseStatePath, fallbackState)
      appendSupervisorLog(
        layout.logsDir,
        `release crash loop guard switched runtime to fallback version=${fallbackVersion} from release=${runtimeSelection.version}`,
      )
      appendPendingActivityEvents(layout.pendingActivityPath, [
        {
          type: 'UPDATE_APPLY_FAILED',
          message: `Release ${runtimeSelection.version} entered crash loop; switched to fallback runtime`,
          severity: 'danger',
          metadata: {
            version: runtimeSelection.version,
            fallbackVersion,
            failures: consecutiveReleaseRuntimeFailures,
          },
          occurred_at: now,
        },
        {
          type: 'ROLLBACK_EXECUTED',
          message: `Rollback executed to fallback runtime ${fallbackVersion}`,
          severity: 'warning',
          metadata: {
            rollbackVersion: fallbackVersion,
            crashLoopDetected: failureTracked.isCrashLoop,
          },
          occurred_at: now,
        },
      ])
      consecutiveReleaseRuntimeFailures = 0
      await sleep(RESTART_BACKOFF_MS)
      continue
    }

    if (exitAction === 'stop-graceful') {
      appendSupervisorLog(layout.logsDir, 'runtime exited cleanly, supervisor stopping')
      break
    }

    if (exitAction === 'stop-config-error') {
      appendSupervisorLog(
        layout.logsDir,
        'runtime exited with configuration error (code=50), supervisor stopping without restart',
      )
      supervisorExitCode = EXIT_CONFIG_ERROR
      break
    }

    appendSupervisorLog(
      layout.logsDir,
      `runtime exited with code=${runResult.exitCode ?? 'unknown'}, restarting after backoff`,
    )
    await sleep(RESTART_BACKOFF_MS)
  }

  process.exitCode = supervisorExitCode
}

void main().catch((error) => {
  console.error(`[supervisor] fatal error: ${toErrorMessage(error)}`)
  process.exitCode = EXIT_FATAL
})
