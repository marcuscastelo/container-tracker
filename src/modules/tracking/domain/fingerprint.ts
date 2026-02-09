import { createHash } from 'node:crypto'
import type { ObservationDraft } from '~/modules/tracking/domain/observationDraft'

/**
 * Computes a deterministic fingerprint for an ObservationDraft.
 *
 * The fingerprint is used for deduplication: if two drafts from different
 * snapshots produce the same fingerprint, they represent the same semantic fact.
 *
 * Fields used (and why):
 *   - container_number: identifies the physical entity
 *   - type: semantic category of the event
 *   - event_time: when it happened (normalized to date-only UTC to avoid timezone drift)
 *   - location_code: where it happened
 *   - vessel_name: on which vessel (important for LOAD/DISCHARGE)
 *   - voyage: which voyage
 *
 * Fields EXCLUDED (unstable across snapshots):
 *   - snapshot_id, provider, raw_event, confidence, location_display, is_empty
 *
 * @see docs/master-consolidated-0209.md §4.2.1
 */
export function computeFingerprint(draft: ObservationDraft): string {
  // Normalize event_time to date-only (YYYY-MM-DD) to handle timezone variations.
  // If event_time is null, use empty string — two observations with null event_time
  // and identical other fields will collide (which is correct).
  const dateOnly = draft.event_time ? draft.event_time.slice(0, 10) : ''

  const parts = [
    draft.container_number.toUpperCase().trim(),
    draft.type,
    dateOnly,
    (draft.location_code ?? '').toUpperCase().trim(),
    (draft.vessel_name ?? '').toUpperCase().trim(),
    (draft.voyage ?? '').toUpperCase().trim(),
  ]

  const canonical = parts.join('|')
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32)
}
