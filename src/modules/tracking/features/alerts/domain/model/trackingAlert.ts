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
   * Deterministic fingerprint for FACT alerts (used for deduplication).
   * Nullable for MONITORING alerts (which use TYPE-based dedup only).
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
