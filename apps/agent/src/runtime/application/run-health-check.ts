import type { ChildProcess } from 'node:child_process'
import { HEALTH_POLL_INTERVAL_MS } from '@agent/runtime/domain/runtime-health-policy'
import { stopRuntimeProcess } from '@agent/runtime/infrastructure/process-runner'
import { readRuntimeState } from '@agent/runtime/infrastructure/runtime-state.repository'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function monitorRuntimeHealthGate(command: {
  readonly child: ChildProcess
  readonly expectedVersion: string
  readonly startupTimeoutMs: number
  readonly healthGraceMs: number
  readonly healthPath: string
  readonly onStabilityConfirmed: () => void
}): Promise<{
  readonly startupConfirmed: boolean
  readonly startupTimedOut: boolean
  readonly healthGraceConfirmed: boolean
}> {
  let childExited = false
  command.child.once('exit', () => {
    childExited = true
  })

  let startupConfirmed = false
  let startupTimedOut = false
  let healthGraceConfirmed = false
  let onStabilityConfirmedCalled = false

  const startupDeadlineMs = Date.now() + command.startupTimeoutMs
  while (!childExited && Date.now() < startupDeadlineMs) {
    const health = readRuntimeState(command.healthPath)
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
    stopRuntimeProcess(command.child)
    return {
      startupConfirmed,
      startupTimedOut,
      healthGraceConfirmed,
    }
  }

  if (!startupConfirmed) {
    return {
      startupConfirmed,
      startupTimedOut,
      healthGraceConfirmed,
    }
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

  return {
    startupConfirmed,
    startupTimedOut,
    healthGraceConfirmed,
  }
}
