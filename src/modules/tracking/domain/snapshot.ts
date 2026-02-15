import type { Provider } from '~/modules/tracking/domain/provider'

/**
 * Snapshot — immutable record of what a carrier API returned at a given moment.
 *
 * Snapshots are append-only. We never mutate or delete them.
 * The `payload` field stores the raw JSON response verbatim.
 *
 * @see docs/master-consolidated-0209.md §2.3
 */
export type Snapshot = {
  /** Primary key (UUID) */
  id: string

  /** Which container this snapshot was fetched for */
  container_id: string

  /** Provider that returned this data */
  provider: Provider

  /** When the API call was made (UTC ISO string) */
  fetched_at: string

  /** Raw JSON payload — kept verbatim, never modified */
  payload: unknown

  /** Optional: if the parsing failed, store the error message */
  parse_error?: string | null
}

/**
 * Shape for inserting a new snapshot (id auto-generated on DB side).
 */
export type NewSnapshot = Omit<Snapshot, 'id'>
