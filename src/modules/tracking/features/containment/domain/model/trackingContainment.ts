import type { PersistedProvider } from '~/modules/tracking/domain/model/provider'

export const TRACKING_CONTAINMENT_REASON_CODE = 'CONTAINER_REUSED_AFTER_COMPLETION' as const
const LEGACY_TRACKING_CONTAINMENT_REASON_CODE = 'POST_COMPLETION_TRACKING_CONTINUED' as const

export const TRACKING_CONTAINMENT_ISSUE_CODES = [
  TRACKING_CONTAINMENT_REASON_CODE,
  LEGACY_TRACKING_CONTAINMENT_REASON_CODE,
] as const

export type TrackingContainmentReasonCode = typeof TRACKING_CONTAINMENT_REASON_CODE

export type TrackingContainmentState = {
  readonly active: true
  readonly reasonCode: TrackingContainmentReasonCode
  readonly activatedAt: string
  readonly provider: PersistedProvider
  readonly snapshotId: string
  readonly lifecycleKey: string
  readonly stateFingerprint: string
  readonly evidenceSummary: string
}

export type ActivateTrackingContainmentCommand = {
  readonly containerId: string
  readonly provider: PersistedProvider
  readonly snapshotId: string
  readonly activatedAt: string
  readonly stateFingerprint: string
  readonly evidenceSummary: string
}

export function isTrackingContainmentIssueCode(value: string): boolean {
  return TRACKING_CONTAINMENT_ISSUE_CODES.some((issueCode) => issueCode === value)
}
