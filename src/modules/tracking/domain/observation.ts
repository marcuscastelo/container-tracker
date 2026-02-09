import z from 'zod/v4'
import { ConfidenceSchema } from '~/modules/tracking/domain/observationDraft'
import { ObservationTypeSchema } from '~/modules/tracking/domain/observationType'
import { ProviderSchema } from '~/modules/tracking/domain/provider'

/**
 * EventTimeType — differentiates between confirmed facts and predictions.
 *
 * ACTUAL: A confirmed, factual event that has occurred.
 *         Only ACTUAL events can advance container status definitively.
 *
 * EXPECTED: A prediction, estimate, or planned event.
 *           Can be used for ETA calculations and monitoring alerts,
 *           but does NOT advance container status.
 *
 * @see Issue: Canonical differentiation between ACTUAL vs EXPECTED
 */
export const EventTimeTypeSchema = z.enum(['ACTUAL', 'EXPECTED'])
export type EventTimeType = z.infer<typeof EventTimeTypeSchema>

/**
 * Observation — a persisted, deduplicated semantic fact.
 *
 * Observations are the atoms of truth in the system.
 * They are derived from snapshots, fingerprinted, and never deleted.
 *
 * Key properties:
 *   - Immutable once persisted
 *   - Deduplicated by fingerprint
 *   - Always linked to the snapshot that originated them
 *
 * @see docs/master-consolidated-0209.md §2.4
 */
export const ObservationSchema = z.object({
  /** Primary key (UUID) */
  id: z.uuid(),

  /** Deterministic fingerprint for deduplication */
  fingerprint: z.string(),

  /** Container ID (FK to containers table) */
  container_id: z.uuid(),

  /** Container number (denormalized for queries) */
  container_number: z.string(),

  /** Semantic type */
  type: ObservationTypeSchema,

  /** When the event occurred (UTC ISO), null if unknown */
  event_time: z.iso.datetime().nullable(),

  /**
   * Whether this is an ACTUAL (confirmed) or EXPECTED (predicted) event.
   * Defaults to EXPECTED if carrier data doesn't explicitly indicate.
   *
   * Rules:
   * - ACTUAL events can advance container status
   * - EXPECTED events are informational only (ETA, predictions)
   * - If uncertain, adapters should use EXPECTED and generate Alert[data]
   */
  event_time_type: EventTimeTypeSchema,

  /** UN/LOCODE */
  location_code: z.string().nullable(),

  /** Human-readable location */
  location_display: z.string().nullable(),

  /** Vessel name */
  vessel_name: z.string().nullable(),

  /** Voyage number */
  voyage: z.string().nullable(),

  /** Whether the container was empty */
  is_empty: z.boolean().nullable(),

  /** Confidence level */
  confidence: ConfidenceSchema,

  /** Provider that produced this data */
  provider: ProviderSchema,

  /** Snapshot that first introduced this observation */
  created_from_snapshot_id: z.uuid(),

  /** When the observation was first persisted (UTC ISO) */
  created_at: z.iso.datetime(),

  /** Whether this observation was derived from a backfill/retroactive snapshot */
  retroactive: z.boolean().optional(),
})

export type Observation = z.infer<typeof ObservationSchema>

/**
 * Shape for inserting — omits server-generated fields.
 */
export const NewObservationSchema = ObservationSchema.omit({ id: true, created_at: true })
export type NewObservation = z.infer<typeof NewObservationSchema>
