import z from 'zod/v4'
import { ObservationTypeSchema } from '~/modules/tracking/domain/observationType'
import { ProviderSchema } from '~/modules/tracking/domain/provider'

/**
 * Confidence level of an observation.
 * Determined during normalization based on field completeness.
 */
export const ConfidenceSchema = z.enum(['high', 'medium', 'low'])
export type Confidence = z.infer<typeof ConfidenceSchema>

/**
 * ObservationDraft — output of normalizeSnapshot, before deduplication.
 *
 * An ObservationDraft is a semantic fact extracted from a carrier snapshot.
 * It does NOT have an `id` or `fingerprint` yet — those are computed
 * during the diff/persist step.
 *
 * @see docs/master-consolidated-0209.md §2.4
 */
export const ObservationDraftSchema = z.object({
  /** Container number this observation refers to */
  container_number: z.string(),

  /** Semantic type of observation */
  type: ObservationTypeSchema,

  /** When the event occurred (UTC ISO), null if unknown */
  event_time: z.iso.datetime().nullable(),

  /** UN/LOCODE or similar location code, null if unknown */
  location_code: z.string().nullable(),

  /** Human-readable location display (e.g. "SANTOS, BR") */
  location_display: z.string().nullable(),

  /** Vessel name, null if not applicable */
  vessel_name: z.string().nullable(),

  /** Voyage number, null if not applicable */
  voyage: z.string().nullable(),

  /** Whether the container was empty at this point */
  is_empty: z.boolean().nullable(),

  /** Confidence level based on field completeness */
  confidence: ConfidenceSchema,

  /** Provider that produced this data */
  provider: ProviderSchema,

  /** ID of the snapshot this draft was extracted from */
  snapshot_id: z.uuid(),

  /** Reference to the raw event inside the snapshot payload (for audit) */
  raw_event: z.unknown().optional(),
})

export type ObservationDraft = z.infer<typeof ObservationDraftSchema>
