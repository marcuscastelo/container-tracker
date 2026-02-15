import type { Provider } from '~/modules/tracking/domain/provider'

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

export type TrackingAlert = {
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

  /** Human-readable summary */
  message: string

  /** When the underlying fact was detected in the timeline (UTC ISO) */
  detected_at: string

  /** When this alert was created/persisted (UTC ISO) */
  triggered_at: string

  /** Fingerprints of observations that triggered this alert */
  source_observation_fingerprints: string[]

  /**
   * Deterministic fingerprint for FACT alerts (used for deduplication).
   * Nullable for MONITORING alerts (which use TYPE-based dedup only).
   * @see src/modules/tracking/domain/alertFingerprint.ts
   */
  alert_fingerprint: string | null

  /** Whether this is a retroactive alert (backfill). Only true for fact alerts. */
  retroactive: boolean

  /** Provider, if attributable */
  provider: Provider | null

  /** When acknowledged by user (UTC ISO) */
  acked_at: string | null

  /** When dismissed by user (UTC ISO) */
  dismissed_at: string | null
}

/**
 * Shape for inserting a new tracking alert.
 */
export type NewTrackingAlert = Omit<TrackingAlert, 'id'>
