import z from 'zod/v4'
import { ProviderSchema } from '~/modules/tracking/domain/provider'

/**
 * Tracking Alert — derived signal from timeline/status analysis.
 *
 * Alerts are divided into:
 *   - fact: derived from observed facts (e.g. transshipment). Can be retroactive.
 *   - monitoring: time-based (e.g. no movement). NEVER retroactive.
 *
 * @see docs/master-consolidated-0209.md §3
 */
const TrackingAlertCategorySchema = z.enum(['fact', 'monitoring'])
const TrackingAlertSeveritySchema = z.enum(['info', 'warning', 'danger'])

const TrackingAlertTypeSchema = z.enum([
  /** Transshipment detected */
  'TRANSSHIPMENT',
  /** Customs hold */
  'CUSTOMS_HOLD',
  /** Final port changed */
  'PORT_CHANGE',
  /** No movement for X days */
  'NO_MOVEMENT',
  /** ETA passed without arrival */
  'ETA_PASSED',
  /** ETA missing */
  'ETA_MISSING',
  /** Data inconsistency detected */
  'DATA_INCONSISTENT',
])

export const TrackingAlertSchema = z.object({
  /** Primary key (UUID) */
  id: z.uuid(),

  /** Container ID (FK) */
  container_id: z.uuid(),

  /** Alert category: fact or monitoring */
  category: TrackingAlertCategorySchema,

  /** Specific alert type */
  type: TrackingAlertTypeSchema,

  /** Severity level */
  severity: TrackingAlertSeveritySchema,

  /** Human-readable summary */
  message: z.string(),

  /** When the underlying fact was detected in the timeline (UTC ISO) */
  detected_at: z.iso.datetime(),

  /** When this alert was created/persisted (UTC ISO) */
  triggered_at: z.iso.datetime(),

  /** Fingerprints of observations that triggered this alert */
  source_observation_fingerprints: z.array(z.string()),

  /**
   * Deterministic fingerprint for FACT alerts (used for deduplication).
   * Nullable for MONITORING alerts (which use TYPE-based dedup only).
   * @see src/modules/tracking/domain/alertFingerprint.ts
   */
  alert_fingerprint: z.string().nullable(),

  /** Whether this is a retroactive alert (backfill). Only true for fact alerts. */
  retroactive: z.boolean(),

  /** Provider, if attributable */
  provider: ProviderSchema.nullable(),

  /** When acknowledged by user (UTC ISO) */
  acked_at: z.iso.datetime().nullable(),

  /** When dismissed by user (UTC ISO) */
  dismissed_at: z.iso.datetime().nullable(),
})

export type TrackingAlert = z.infer<typeof TrackingAlertSchema>

/**
 * Shape for inserting a new tracking alert.
 */
export const NewTrackingAlertSchema = TrackingAlertSchema.omit({ id: true })
export type NewTrackingAlert = z.infer<typeof NewTrackingAlertSchema>
