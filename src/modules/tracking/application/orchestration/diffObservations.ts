import { computeFingerprint } from '~/modules/tracking/domain/identity/fingerprint'
import type { NewObservation } from '~/modules/tracking/domain/model/observation'
import type { ObservationDraft } from '~/modules/tracking/domain/model/observationDraft'

/**
 * Diff observation drafts against already-persisted observations.
 *
 * Returns only NEW observations (drafts whose fingerprints are not
 * already present in `existingFingerprints`).
 *
 * This is the deduplication step of the pipeline:
 *   currDrafts - existingFingerprints = newObservations
 *
 * Never removes old observations — observations are append-only facts.
 *
 * @param existingFingerprints - Set of fingerprints already persisted for this container
 * @param drafts - ObservationDrafts from the current snapshot normalization
 * @param containerId - UUID of the container entity
 * @returns Array of NewObservation ready to persist
 *
 * @see docs/master-consolidated-0209.md §4.2
 */
export function diffObservations(
  existingFingerprints: ReadonlySet<string>,
  drafts: readonly ObservationDraft[],
  containerId: string,
): NewObservation[] {
  const newObservations: NewObservation[] = []
  /** Track fingerprints within this batch to avoid duplicates from the same snapshot */
  const seenInBatch = new Set<string>()

  for (const draft of drafts) {
    const fingerprint = computeFingerprint(draft)

    // Skip if already persisted or already seen in this batch
    if (existingFingerprints.has(fingerprint)) continue
    if (seenInBatch.has(fingerprint)) continue
    seenInBatch.add(fingerprint)

    const newObs: NewObservation = {
      fingerprint,
      container_id: containerId,
      container_number: draft.container_number,
      type: draft.type,
      event_time: draft.event_time,
      event_time_type: draft.event_time_type,
      location_code: draft.location_code,
      location_display: draft.location_display,
      vessel_name: draft.vessel_name,
      voyage: draft.voyage,
      is_empty: draft.is_empty,
      confidence: draft.confidence,
      provider: draft.provider,
      created_from_snapshot_id: draft.snapshot_id,
      retroactive: false,
    }

    newObservations.push(newObs)
  }

  return newObservations
}
