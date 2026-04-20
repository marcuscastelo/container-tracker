import type { TrackingValidationAffectedScope } from '~/modules/tracking/features/validation/domain/model/trackingValidationAffectedScope'
import type {
  TrackingValidationLifecycleState,
  TrackingValidationLifecycleTransition,
  TrackingValidationLifecycleTransitionType,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationLifecycle'
import type { TrackingValidationSeverity } from '~/modules/tracking/features/validation/domain/model/trackingValidationSeverity'
import {
  readProvider,
  requireString,
  requireTimestamp,
} from '~/modules/tracking/infrastructure/persistence/tracking.persistence.mapper-primitives'
import type {
  InsertTrackingValidationLifecycleRow,
  TrackingValidationLifecycleRow,
} from '~/modules/tracking/infrastructure/persistence/tracking.row'

const TRACKING_VALIDATION_AFFECTED_SCOPE_MAP: Record<string, TrackingValidationAffectedScope> = {
  CONTAINER: 'CONTAINER',
  OPERATIONAL: 'OPERATIONAL',
  PROCESS: 'PROCESS',
  SERIES: 'SERIES',
  STATUS: 'STATUS',
  TIMELINE: 'TIMELINE',
}

const TRACKING_VALIDATION_SEVERITY_MAP: Record<string, TrackingValidationSeverity> = {
  ADVISORY: 'ADVISORY',
  CRITICAL: 'CRITICAL',
}

const TRACKING_VALIDATION_TRANSITION_TYPE_MAP: Record<
  string,
  TrackingValidationLifecycleTransitionType
> = {
  activated: 'activated',
  changed: 'changed',
  resolved: 'resolved',
}

function requireTrackingValidationAffectedScope(
  value: unknown,
  field: string,
): TrackingValidationAffectedScope {
  const mapped = TRACKING_VALIDATION_AFFECTED_SCOPE_MAP[requireString(value, field)]
  if (mapped === undefined) {
    throw new Error(
      `tracking persistence mapper: ${field} is not a valid validation affected scope: ${String(value)}`,
    )
  }
  return mapped
}

function requireTrackingValidationSeverity(
  value: unknown,
  field: string,
): TrackingValidationSeverity {
  const mapped = TRACKING_VALIDATION_SEVERITY_MAP[requireString(value, field)]
  if (mapped === undefined) {
    throw new Error(
      `tracking persistence mapper: ${field} is not a valid validation severity: ${String(value)}`,
    )
  }
  return mapped
}

export function requireTrackingValidationTransitionType(
  value: unknown,
  field: string,
): TrackingValidationLifecycleTransitionType {
  const mapped = TRACKING_VALIDATION_TRANSITION_TYPE_MAP[requireString(value, field)]
  if (mapped === undefined) {
    throw new Error(
      `tracking persistence mapper: ${field} is not a valid validation transition type: ${String(value)}`,
    )
  }
  return mapped
}

export function trackingValidationLifecycleRowToState(
  row: TrackingValidationLifecycleRow,
): TrackingValidationLifecycleState {
  return {
    lifecycleKey: requireString(row.lifecycle_key, 'tracking_validation.lifecycle_key'),
    issueCode: requireString(row.issue_code, 'tracking_validation.issue_code'),
    detectorId: requireString(row.detector_id, 'tracking_validation.detector_id'),
    detectorVersion: requireString(row.detector_version, 'tracking_validation.detector_version'),
    affectedScope: requireTrackingValidationAffectedScope(
      row.affected_scope,
      'tracking_validation.affected_scope',
    ),
    severity: requireTrackingValidationSeverity(row.severity, 'tracking_validation.severity'),
    stateFingerprint: requireString(row.state_fingerprint, 'tracking_validation.state_fingerprint'),
    evidenceSummary: requireString(row.evidence_summary, 'tracking_validation.evidence_summary'),
    provider: readProvider(row.provider, 'tracking_validation.provider'),
    snapshotId: requireString(row.snapshot_id, 'tracking_validation.snapshot_id'),
    occurredAt: requireTimestamp(row.occurred_at, 'tracking_validation.occurred_at'),
  }
}

export function trackingValidationLifecycleTransitionToInsertRow(command: {
  readonly transition: TrackingValidationLifecycleTransition
  readonly processId: string
}): InsertTrackingValidationLifecycleRow {
  return {
    process_id: command.processId,
    container_id: command.transition.containerId,
    issue_code: command.transition.issueCode,
    detector_id: command.transition.detectorId,
    detector_version: command.transition.detectorVersion,
    affected_scope: command.transition.affectedScope,
    severity: command.transition.severity,
    transition_type: command.transition.transitionType,
    lifecycle_key: command.transition.lifecycleKey,
    state_fingerprint: command.transition.stateFingerprint,
    evidence_summary: command.transition.evidenceSummary,
    provider: command.transition.provider,
    snapshot_id: command.transition.snapshotId,
    occurred_at: command.transition.occurredAt,
  }
}
