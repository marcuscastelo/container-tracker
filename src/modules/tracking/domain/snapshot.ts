import z from 'zod/v4'
import { ProviderSchema } from '~/modules/tracking/domain/provider'

/**
 * Snapshot — immutable record of what a carrier API returned at a given moment.
 *
 * Snapshots are append-only. We never mutate or delete them.
 * The `payload` field stores the raw JSON response verbatim.
 *
 * @see docs/master-consolidated-0209.md §2.3
 */
export const SnapshotSchema = z.object({
  /** Primary key (UUID) */
  id: z.uuid(),

  /** Which container this snapshot was fetched for */
  container_id: z.uuid(),

  /** Provider that returned this data */
  provider: ProviderSchema,

  /** When the API call was made (UTC ISO string) */
  fetched_at: z.iso.datetime(),

  /** Raw JSON payload — kept verbatim, never modified */
  payload: z.unknown(),

  /** Optional: if the parsing failed, store the error message */
  parse_error: z.string().nullable().optional(),
})

export type Snapshot = z.infer<typeof SnapshotSchema>

/**
 * Shape for inserting a new snapshot (id auto-generated on DB side).
 */
export const NewSnapshotSchema = SnapshotSchema.omit({ id: true })
export type NewSnapshot = z.infer<typeof NewSnapshotSchema>
