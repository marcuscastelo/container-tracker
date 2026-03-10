import type { Provider } from '~/modules/tracking/domain/model/provider'

/**
 * Tracking Alert — derived signal from timeline/status analysis.
 *
 * Alerts are divided into:
 *   - fact: derived from observed facts (e.g. transshipment). Can be retroactive.
 *   - monitoring: time-based (e.g. no movement). NEVER retroactive.
 *
 * @see docs/master-consolidated-0209.md §3
 */
export type TrackingAlertCategory = 'fact' | 'monitoring'
export type TrackingAlertSeverity = 'info' | 'warning' | 'danger'
export type TrackingAlertLifecycleState = 'ACTIVE' | 'ACKED' | 'AUTO_RESOLVED'
export type TrackingAlertResolvedReason = 'condition_cleared' | 'terminal_state'

export type TrackingAlertType =
  /** Transshipment detected */
  | 'TRANSSHIPMENT'
  /** Customs hold */
  | 'CUSTOMS_HOLD'
  /** Final port changed */
  | 'PORT_CHANGE'
  /** No movement for X days */
  | 'NO_MOVEMENT'
  /** ETA passed without arrival */
  | 'ETA_PASSED'
  /** ETA missing */
  | 'ETA_MISSING'
  /** Data inconsistency detected */
  | 'DATA_INCONSISTENT'

export type TrackingAlertAckSource = 'dashboard' | 'process_view' | 'api'

type EmptyAlertMessageParams = Readonly<Record<never, never>>

export type TrackingAlertMessageContract =
  | {
      readonly message_key: 'alerts.transshipmentDetected'
      readonly message_params: {
        readonly port: string
        readonly fromVessel: string
        readonly toVessel: string
      }
    }
  | {
      readonly message_key: 'alerts.customsHoldDetected'
      readonly message_params: {
        readonly location: string
      }
    }
  | {
      readonly message_key: 'alerts.noMovementDetected'
      readonly message_params: {
        readonly threshold_days: number
        readonly days_without_movement: number
        readonly days: number
        readonly lastEventDate: string
      }
    }
  | {
      readonly message_key: 'alerts.etaMissing'
      readonly message_params: EmptyAlertMessageParams
    }
  | {
      readonly message_key: 'alerts.etaPassed'
      readonly message_params: EmptyAlertMessageParams
    }
  | {
      readonly message_key: 'alerts.portChange'
      readonly message_params: EmptyAlertMessageParams
    }
  | {
      readonly message_key: 'alerts.dataInconsistent'
      readonly message_params: EmptyAlertMessageParams
    }

export type TrackingAlertMessageKey = TrackingAlertMessageContract['message_key']
export type TrackingAlertMessageParams = TrackingAlertMessageContract['message_params']

type TrackingAlertBase = {
  /** Lifecycle state of this alert record */
  lifecycle_state?: TrackingAlertLifecycleState

  /** Primary key (UUID) */
  id: string

  /** Container ID (FK) */
  container_id: string

  /** Alert category: fact or monitoring */
  category: TrackingAlertCategory

  /** Specific alert type */
  type: TrackingAlertType

  /** Severity level */
  severity: TrackingAlertSeverity

  /** When the underlying fact was detected in the timeline (UTC ISO) */
  detected_at: string

  /** When this alert was created/persisted (UTC ISO) */
  triggered_at: string

  /** Fingerprints of observations that triggered this alert */
  source_observation_fingerprints: string[]

  /**
   * Deterministic fingerprint for alerts that require episode-aware idempotency.
   * Nullable for alerts that are intentionally type-only.
   * @see src/modules/tracking/features/alerts/domain/identity/alertFingerprint.ts
   */
  alert_fingerprint: string | null

  /** Whether this is a retroactive alert (backfill). Only true for fact alerts. */
  retroactive: boolean

  /** Provider, if attributable */
  provider: Provider | null

  /** When acknowledged by user (UTC ISO) */
  acked_at: string | null

  /** Optional user identifier that acknowledged this alert */
  acked_by: string | null

  /** Optional source context where this alert was acknowledged */
  acked_source: TrackingAlertAckSource | null

  /** When this alert was auto-resolved by system lifecycle logic (UTC ISO) */
  resolved_at?: string | null

  /** Why this alert was auto-resolved */
  resolved_reason?: TrackingAlertResolvedReason | null
}

/**
 * Tracking alert with semantic message contract bound by discriminated union.
 */
export type TrackingAlert = TrackingAlertBase & TrackingAlertMessageContract

/**
 * Shape for inserting a new tracking alert.
 */
type NewTrackingAlertBase = Omit<TrackingAlertBase, 'id'>
export type NewTrackingAlert = NewTrackingAlertBase & TrackingAlertMessageContract

export function resolveAlertLifecycleState(alert: {
  readonly lifecycle_state?: TrackingAlertLifecycleState
  readonly acked_at: string | null
  readonly resolved_at?: string | null
}): TrackingAlertLifecycleState {
  if (alert.lifecycle_state === 'ACTIVE') return 'ACTIVE'
  if (alert.lifecycle_state === 'ACKED') return 'ACKED'
  if (alert.lifecycle_state === 'AUTO_RESOLVED') return 'AUTO_RESOLVED'
  if (alert.acked_at !== null) return 'ACKED'
  if (alert.resolved_at !== null && alert.resolved_at !== undefined) return 'AUTO_RESOLVED'
  return 'ACTIVE'
}
