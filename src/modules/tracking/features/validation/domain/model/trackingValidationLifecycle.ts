import type { PersistedProvider } from '~/modules/tracking/domain/model/provider'
import type { TrackingValidationAffectedScope } from '~/modules/tracking/features/validation/domain/model/trackingValidationAffectedScope'
import type { TrackingValidationSeverity } from '~/modules/tracking/features/validation/domain/model/trackingValidationSeverity'

export type TrackingValidationLifecycleTransitionType = 'activated' | 'changed' | 'resolved'

export type TrackingValidationLifecycleState = {
  readonly lifecycleKey: string
  readonly issueCode: string
  readonly detectorId: string
  readonly detectorVersion: string
  readonly affectedScope: TrackingValidationAffectedScope
  readonly severity: TrackingValidationSeverity
  readonly stateFingerprint: string
  // Persist only the product-safe summary; debugEvidence remains internal to the detector finding.
  readonly evidenceSummary: string
  readonly provider: PersistedProvider
  readonly snapshotId: string
  readonly occurredAt: string
}

export type TrackingValidationLifecycleTransition = TrackingValidationLifecycleState & {
  readonly containerId: string
  readonly transitionType: TrackingValidationLifecycleTransitionType
}

export type TrackingValidationLifecycleTransitionContext = {
  readonly containerId: string
  readonly provider: PersistedProvider
  readonly snapshotId: string
  readonly occurredAt: string
}

export function toTrackingValidationLifecycleState(
  transition: TrackingValidationLifecycleTransition,
): TrackingValidationLifecycleState | null {
  if (transition.transitionType === 'resolved') {
    return null
  }

  return {
    lifecycleKey: transition.lifecycleKey,
    issueCode: transition.issueCode,
    detectorId: transition.detectorId,
    detectorVersion: transition.detectorVersion,
    affectedScope: transition.affectedScope,
    severity: transition.severity,
    stateFingerprint: transition.stateFingerprint,
    evidenceSummary: transition.evidenceSummary,
    provider: transition.provider,
    snapshotId: transition.snapshotId,
    occurredAt: transition.occurredAt,
  }
}
