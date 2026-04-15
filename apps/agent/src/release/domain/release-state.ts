import type {
  ReleaseFailureEntry,
  ReleaseState,
} from '@agent/core/contracts/release-state.contract'

export type ActivationState = ReleaseState['activation_state']

export function createInitialReleaseState(currentVersion: string): ReleaseState {
  return {
    current_version: currentVersion,
    previous_version: null,
    last_known_good_version: currentVersion,
    target_version: null,
    activation_state: 'idle',
    failure_count: 0,
    last_update_attempt: null,
    blocked_versions: [],
    automatic_updates_blocked: false,
    recent_failures: [],
    activation_failures: {},
    last_error: null,
  }
}

export function migrateReleaseState(state: ReleaseState): ReleaseState {
  const hasLegacyCrashLoopBlock =
    state.activation_state === 'blocked' ||
    state.last_error === 'automatic updates are blocked due to previous crash loop'

  if (!state.automatic_updates_blocked || !hasLegacyCrashLoopBlock) {
    return state
  }

  return {
    ...state,
    automatic_updates_blocked: false,
    activation_state: state.activation_state === 'blocked' ? 'idle' : state.activation_state,
    last_error:
      state.last_error ??
      `version ${state.blocked_versions.at(-1) ?? 'unknown'} blocked after crash loop`,
  }
}

export function hasBlockedVersion(state: ReleaseState, version: string): boolean {
  return state.blocked_versions.includes(version)
}

export function withRecordedFailure(command: {
  readonly state: ReleaseState
  readonly version: string
  readonly nowIso: string
  readonly crashLoopWindowMs: number
  readonly crashLoopThreshold: number
  readonly maxActivationFailures: number
}): {
  readonly nextState: ReleaseState
  readonly isCrashLoop: boolean
  readonly activationFailuresForVersion: number
  readonly versionBlocked: boolean
  readonly newlyBlocked: boolean
} {
  const nowMs = new Date(command.nowIso).getTime()
  const windowStartMs = nowMs - command.crashLoopWindowMs

  const inWindow = command.state.recent_failures.filter((entry) => {
    const occurredAtMs = new Date(entry.occurred_at).getTime()
    if (Number.isNaN(occurredAtMs)) {
      return false
    }

    return occurredAtMs >= windowStartMs
  })

  const failureEntry: ReleaseFailureEntry = {
    version: command.version,
    occurred_at: command.nowIso,
  }

  const failures = [...inWindow, failureEntry]
  const failuresForVersion = failures.filter((entry) => entry.version === command.version).length
  const crashLoopDetected = failuresForVersion >= command.crashLoopThreshold
  const currentActivationFailures = command.state.activation_failures[command.version] ?? 0
  const activationFailuresForVersion = currentActivationFailures + 1
  const activationFailures = {
    ...command.state.activation_failures,
    [command.version]: activationFailuresForVersion,
  }
  const activationFailureLimitReached = activationFailuresForVersion >= command.maxActivationFailures

  const blockedVersions =
    crashLoopDetected || activationFailureLimitReached
      ? [...new Set([...command.state.blocked_versions, command.version])]
      : [...command.state.blocked_versions]

  const versionBlocked = blockedVersions.includes(command.version)
  const newlyBlocked = versionBlocked && !command.state.blocked_versions.includes(command.version)

  return {
    nextState: {
      ...command.state,
      failure_count: command.state.failure_count + 1,
      recent_failures: failures,
      activation_failures: activationFailures,
      blocked_versions: blockedVersions,
      automatic_updates_blocked: command.state.automatic_updates_blocked,
      activation_state: command.state.activation_state,
    },
    isCrashLoop: crashLoopDetected,
    activationFailuresForVersion,
    versionBlocked,
    newlyBlocked,
  }
}
