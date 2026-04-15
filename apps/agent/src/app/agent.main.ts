#!/usr/bin/env node

import type { ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { ensureAgentPathLayout, resolveAgentPathLayout } from '@agent/config/resolve-agent-paths'
import {
  readCurrentControlRuntimeConfig,
  syncAgentControlState,
} from '@agent/control-core/agent-control-core'
import {
  publishAgentControlPublicSnapshot,
  refreshAgentControlPublicLogs,
} from '@agent/control-core/public-control-files'
import { appendPendingActivityEvents } from '@agent/pending-activity'
import { resolvePlatformAdapter } from '@agent/platform/platform.adapter'
import {
  activatePendingRelease,
  confirmActivatedRelease,
} from '@agent/release/application/activate-release'
import { runReleaseCheckCycle } from '@agent/release/application/check-for-update'
import {
  createRuntimeLaunchSpec,
  getCurrentRelease,
} from '@agent/release/application/get-current-release'
import { recordReleaseFailure } from '@agent/release/application/record-release-failure'
import {
  RELEASE_CHECK_INTERVAL_MS,
  resolveSupervisorReleaseChecksMode,
} from '@agent/release/application/release-checks-mode'
import { ensureReleaseLinksForCurrentState } from '@agent/release/application/release-layout'
import { rollbackRelease, selectRollbackVersion } from '@agent/release/application/rollback-release'
import {
  readReleaseState,
  writeReleaseState,
} from '@agent/release/infrastructure/release-state.file-repository'
import { requestRuntimeDrain } from '@agent/runtime/application/drain-runtime'
import {
  DEFAULT_HEALTH_GRACE_MS,
  DEFAULT_STARTUP_TIMEOUT_MS,
  shouldRollbackAfterHealthGate,
} from '@agent/runtime/application/runtime-health-gate'
import {
  type ChildRunOutcome,
  runRuntimeWithHealthGate,
  runRuntimeWithoutHealthGate,
} from '@agent/runtime/application/supervise-runtime'
import { clearSupervisorControl } from '@agent/runtime/infrastructure/supervisor-control.repository'
import {
  EXIT_CONFIG_ERROR,
  EXIT_FATAL,
  EXIT_OK,
  resolveSupervisorExitAction,
} from '@agent/runtime/lifecycle-exit-codes'

const DEFAULT_CRASH_LOOP_WINDOW_MS = 5 * 60 * 1000
const DEFAULT_CRASH_LOOP_THRESHOLD = 3
const DEFAULT_MAX_ACTIVATION_FAILURES = 5
const RESTART_BACKOFF_MS = 2_000
const MAX_SUPERVISOR_LOG_FILE_SIZE_BYTES = 10 * 1024 * 1024
const PUBLIC_ARTIFACT_REFRESH_DEBOUNCE_MS = 150
const PUBLIC_SNAPSHOT_REFRESH_INTERVAL_MS = 5_000

type PublicArtifactPublisher = {
  readonly requestRefresh: () => void
  readonly publishNow: () => void
}

let publicArtifactPublisher: PublicArtifactPublisher | null = null

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

async function publishSupervisorPublicSnapshot(
  layout: ReturnType<typeof resolveAgentPathLayout>,
): Promise<void> {
  try {
    await publishAgentControlPublicSnapshot({
      filePath: layout.publicStatePath,
      backendStatePath: layout.publicBackendStatePath,
      layout,
      forceRemoteFetch: false,
    })
  } catch (error) {
    console.warn(`[supervisor] failed to publish public control state: ${toErrorMessage(error)}`)
  }
}

function refreshPublicLogArtifacts(layout: ReturnType<typeof resolveAgentPathLayout>): void {
  try {
    refreshAgentControlPublicLogs({
      filePath: layout.publicLogsPath,
      layout,
    })
  } catch (error) {
    console.warn(`[supervisor] failed to refresh public control logs: ${toErrorMessage(error)}`)
  }
}

function createPublicArtifactPublisher(
  layout: ReturnType<typeof resolveAgentPathLayout>,
): PublicArtifactPublisher {
  let timer: NodeJS.Timeout | null = null

  return {
    requestRefresh() {
      if (timer) {
        return
      }

      timer = setTimeout(() => {
        timer = null
        refreshPublicLogArtifacts(layout)
      }, PUBLIC_ARTIFACT_REFRESH_DEBOUNCE_MS)
      timer.unref?.()
    },
    publishNow() {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }

      refreshPublicLogArtifacts(layout)
    },
  }
}

function requestPublicArtifactRefresh(): void {
  publicArtifactPublisher?.requestRefresh()
}

function startPublicSnapshotRefreshLoop(
  layout: ReturnType<typeof resolveAgentPathLayout>,
): NodeJS.Timeout | null {
  const timer = setInterval(() => {
    void publishSupervisorPublicSnapshot(layout)
  }, PUBLIC_SNAPSHOT_REFRESH_INTERVAL_MS)
  timer.unref?.()
  return timer
}

function normalizePathForEntryComparison(targetPath: string): string {
  const normalized = path.resolve(targetPath).replaceAll('\\', '/')
  return resolvePlatformAdapter().key === 'windows-x64' ? normalized.toLowerCase() : normalized
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
  requestPublicArtifactRefresh()
}

function resolveFallbackRuntimeEntrypoint(scriptDir: string): string {
  const candidates = [
    path.resolve(scriptDir, '../agent.js'),
    path.resolve(scriptDir, '../agent.ts'),
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

function startReleaseCheckLoop(command: {
  readonly layout: ReturnType<typeof resolveAgentPathLayout>
  readonly fallbackVersion: string
  readonly isShuttingDown: () => boolean
}): () => void {
  let running = false

  const runCheck = async (): Promise<void> => {
    if (running || command.isShuttingDown()) {
      return
    }

    running = true
    try {
      const currentConfig = readCurrentControlRuntimeConfig(command.layout)
      if (!currentConfig) {
        return
      }

      const controlSync = await syncAgentControlState({
        layout: command.layout,
        currentConfig,
        forceRemoteFetch: false,
      })

      if (controlSync.snapshot.updates.paused.value) {
        return
      }

      const checkMode = resolveSupervisorReleaseChecksMode({
        env: process.env,
        configuredChannel: controlSync.effectiveConfig.AGENT_UPDATE_MANIFEST_CHANNEL,
      })
      if (checkMode.disabled) {
        return
      }

      const releaseState = readReleaseState(
        command.layout.releaseStatePath,
        command.fallbackVersion,
      )
      if (releaseState.activation_state !== 'idle') {
        return
      }

      const result = await runReleaseCheckCycle({
        layout: command.layout,
        fallbackVersion: command.fallbackVersion,
        backendUrl: controlSync.effectiveConfig.BACKEND_URL,
        agentToken: controlSync.effectiveConfig.AGENT_TOKEN,
        agentId: controlSync.effectiveConfig.AGENT_ID,
        updateChannel: controlSync.effectiveConfig.AGENT_UPDATE_MANIFEST_CHANNEL,
        effectiveBlockedVersions: controlSync.snapshot.updates.blockedVersions.effective,
      })

      if (result.activities.length > 0) {
        appendPendingActivityEvents(command.layout.pendingActivityPath, result.activities)
      }

      if (result.shouldDrain && result.drainReason) {
        requestRuntimeDrain({
          supervisorControlPath: command.layout.supervisorControlPath,
          reason: result.drainReason,
          requestedAt: new Date().toISOString(),
        })
        appendSupervisorLog(
          command.layout.logsDir,
          `[update] drain requested (reason=${result.drainReason}, manifest=${result.manifestVersion})`,
        )
      }
    } catch (error) {
      appendSupervisorLog(command.layout.logsDir, `[update] check failed: ${toErrorMessage(error)}`)
    } finally {
      running = false
    }
  }

  void runCheck()

  const timer = setInterval(() => {
    void runCheck()
  }, RELEASE_CHECK_INTERVAL_MS)
  timer.unref?.()

  return () => {
    clearInterval(timer)
  }
}

export async function runAgentMain(): Promise<void> {
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
  publicArtifactPublisher = createPublicArtifactPublisher(layout)
  const publicSnapshotRefreshLoop = startPublicSnapshotRefreshLoop(layout)
  clearSupervisorControl(layout.supervisorControlPath)
  appendSupervisorLog(layout.logsDir, 'supervisor started')
  publicArtifactPublisher.publishNow()
  await publishSupervisorPublicSnapshot(layout)
  const currentConfig = readCurrentControlRuntimeConfig(layout)
  const releaseChecksMode = resolveSupervisorReleaseChecksMode({
    env: process.env,
    configuredChannel: currentConfig?.AGENT_UPDATE_MANIFEST_CHANNEL,
  })
  const releaseChecksDisabled = releaseChecksMode.disabled
  if (releaseChecksDisabled) {
    if (releaseChecksMode.reason === 'EXPLICIT_DISABLE_FLAG') {
      appendSupervisorLog(
        layout.logsDir,
        `automatic update checks disabled by AGENT_DISABLE_AUTOMATIC_UPDATE_CHECKS; forcing fallback runtime selection (configured channel=${releaseChecksMode.configuredChannel ?? 'unknown'})`,
      )
    } else {
      appendSupervisorLog(
        layout.logsDir,
        'automatic update checks disabled; forcing fallback runtime selection',
      )
    }
  }

  let shuttingDown = false
  let supervisorExitCode = EXIT_OK
  let consecutiveReleaseRuntimeFailures = 0
  process.once('SIGINT', () => {
    shuttingDown = true
    if (publicSnapshotRefreshLoop) {
      clearInterval(publicSnapshotRefreshLoop)
    }
  })
  process.once('SIGTERM', () => {
    shuttingDown = true
    if (publicSnapshotRefreshLoop) {
      clearInterval(publicSnapshotRefreshLoop)
    }
  })

  for (;;) {
    if (shuttingDown) {
      break
    }

    let state = readReleaseState(layout.releaseStatePath, fallbackVersion)
    if (!releaseChecksDisabled) {
      ensureReleaseLinksForCurrentState({ layout, state })
    }

    const nowIso = new Date().toISOString()

    if (!releaseChecksDisabled && state.activation_state === 'pending' && state.target_version) {
      try {
        const targetVersion = state.target_version
        state = activatePendingRelease({
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
            : recordReleaseFailure({
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
        state = rollbackRelease({
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

      await publishSupervisorPublicSnapshot(layout)
    }

    state = readReleaseState(layout.releaseStatePath, fallbackVersion)
    const runtimeSelection = releaseChecksDisabled
      ? {
          version: fallbackVersion,
          entrypointPath: fallbackEntrypoint,
          source: 'fallback' as const,
        }
      : getCurrentRelease({
          layout,
          fallbackEntrypoint,
          expectedVersion: state.current_version,
        })
    appendSupervisorLog(
      layout.logsDir,
      `runtime selected source=${runtimeSelection.source} version=${runtimeSelection.version} entrypoint=${runtimeSelection.entrypointPath} activation_state=${state.activation_state}`,
    )
    await publishSupervisorPublicSnapshot(layout)

    clearSupervisorControl(layout.supervisorControlPath)

    const requireHealthGate =
      state.activation_state === 'verifying' &&
      state.target_version !== null &&
      state.current_version === state.target_version

    const launchSpec = createRuntimeLaunchSpec({
      layout,
      resolvedRelease: runtimeSelection,
      baseEnv: process.env,
    })

    const stopReleaseCheckLoop = releaseChecksDisabled
      ? () => {}
      : startReleaseCheckLoop({
          layout,
          fallbackVersion,
          isShuttingDown: () => shuttingDown,
        })

    let runResult: ChildRunOutcome
    try {
      runResult = requireHealthGate
        ? await runRuntimeWithHealthGate({
            scriptPath: launchSpec.entrypointPath,
            expectedVersion: launchSpec.expectedVersion,
            startupTimeoutMs,
            healthGraceMs: HEALTH_GRACE_MS,
            healthPath: launchSpec.healthPath,
            env: launchSpec.env,
            logsDir: launchSpec.logsDir,
            onOutput: requestPublicArtifactRefresh,
            onStabilityConfirmed() {
              const currentState = readReleaseState(layout.releaseStatePath, fallbackVersion)
              if (!currentState.target_version) {
                return
              }

              const confirmedState = confirmActivatedRelease({
                state: currentState,
                confirmedVersion: currentState.target_version,
                nowIso: new Date().toISOString(),
              })
              writeReleaseState(layout.releaseStatePath, confirmedState)
              appendSupervisorLog(
                layout.logsDir,
                `activation confirmed for version=${currentState.target_version}`,
              )
              void publishSupervisorPublicSnapshot(layout)
            },
            onRuntimeStarted(child: ChildProcess) {
              appendSupervisorLog(
                layout.logsDir,
                `started runtime pid=${child.pid ?? 'unknown'} version=${launchSpec.expectedVersion} entrypoint=${launchSpec.entrypointPath}`,
              )
            },
          })
        : await runRuntimeWithoutHealthGate({
            scriptPath: launchSpec.entrypointPath,
            expectedVersion: launchSpec.expectedVersion,
            env: launchSpec.env,
            logsDir: launchSpec.logsDir,
            onOutput: requestPublicArtifactRefresh,
            onRuntimeStarted(child: ChildProcess) {
              appendSupervisorLog(
                layout.logsDir,
                `started runtime pid=${child.pid ?? 'unknown'} version=${launchSpec.expectedVersion} entrypoint=${launchSpec.entrypointPath}`,
              )
            },
          })
    } finally {
      stopReleaseCheckLoop()
    }

    if (shuttingDown) {
      break
    }

    const refreshedState = readReleaseState(layout.releaseStatePath, fallbackVersion)
    await publishSupervisorPublicSnapshot(layout)
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

    const rollbackFromHealthGate =
      requireHealthGate &&
      shouldRollbackAfterHealthGate({
        startupConfirmed: runResult.startupConfirmed,
        startupTimedOut: runResult.startupTimedOut,
        healthGraceConfirmed: runResult.healthGraceConfirmed,
      })

    if (rollbackFromHealthGate && refreshedState.target_version) {
      const failureReason = runResult.startupTimedOut
        ? `startup timeout for version ${refreshedState.target_version}`
        : `unstable runtime for version ${refreshedState.target_version}`

      const failureTracked = recordReleaseFailure({
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

      const rolledBackState = rollbackRelease({
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
      await publishSupervisorPublicSnapshot(layout)
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
      const failureTracked = recordReleaseFailure({
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

      const fallbackState = rollbackRelease({
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
      await publishSupervisorPublicSnapshot(layout)
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

  if (publicSnapshotRefreshLoop) {
    clearInterval(publicSnapshotRefreshLoop)
  }
  process.exitCode = supervisorExitCode
}

function isDirectExecution(moduleUrl: string): boolean {
  const entryArg = process.argv[1]
  if (!entryArg) {
    return false
  }

  const modulePath = fileURLToPath(moduleUrl)
  return normalizePathForEntryComparison(entryArg) === normalizePathForEntryComparison(modulePath)
}

if (isDirectExecution(import.meta.url)) {
  void runAgentMain().catch((error) => {
    console.error(`[supervisor] fatal error: ${toErrorMessage(error)}`)
    process.exitCode = EXIT_FATAL
  })
}
