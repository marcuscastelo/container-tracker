import type { ReleaseState } from '@agent/core/contracts/release-state.contract'
import { withRecordedFailure } from '@agent/release/domain/release-state'

export function recordReleaseFailure(command: {
  readonly state: ReleaseState
  readonly version: string
  readonly nowIso: string
  readonly crashLoopWindowMs: number
  readonly crashLoopThreshold: number
  readonly maxActivationFailures: number
}): ReturnType<typeof withRecordedFailure> {
  return withRecordedFailure(command)
}
