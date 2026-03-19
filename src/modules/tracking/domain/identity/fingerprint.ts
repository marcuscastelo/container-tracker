import { createHash } from 'node:crypto'
import type { ObservationDraft } from '~/modules/tracking/features/observation/domain/model/observationDraft'

/**
 * Computes a deterministic fingerprint for an ObservationDraft.
 *
 * The fingerprint is used for deduplication: if two drafts from different
 * snapshots produce the same fingerprint, they represent the same semantic fact.
 *
 * Fields used (and why):
 *   - container_number: identifies the physical entity
 *   - type: semantic category of the event
 *   - event_time_type: ACTUAL vs EXPECTED — different semantic facts
 *   - event_time: temporal kind + canonical value
 *   - location_code: where it happened
 *   - vessel_name: on which vessel (important for LOAD/DISCHARGE)
 *   - voyage: which voyage
 *
 * Fields EXCLUDED (unstable across snapshots):
 *   - snapshot_id, provider, raw_event, confidence, location_display, is_empty
 *
 * Why event_time_type is included:
 *   An EXPECTED ETA and the later ACTUAL arrival are NOT the same fact.
 *   They must not collide during deduplication.
 *   Including event_time_type ensures stable differentiation.
 *
 * @see docs/master-consolidated-0209.md §4.2.1
 * @see Issue: Canonical differentiation between ACTUAL vs EXPECTED
 */
export function computeFingerprint(draft: ObservationDraft): string {
  const temporalKind = draft.event_time?.kind ?? ''
  let temporalValue = ''
  if (draft.event_time !== null) {
    temporalValue =
      draft.event_time.kind === 'instant'
        ? draft.event_time.value.toIsoString()
        : draft.event_time.value.toIsoDate()
  }

  const parts = [
    draft.container_number.toUpperCase().trim(),
    draft.type,
    draft.event_time_type,
    temporalKind,
    temporalValue,
    (draft.location_code ?? '').toUpperCase().trim(),
    (draft.vessel_name ?? '').toUpperCase().trim(),
    (draft.voyage ?? '').toUpperCase().trim(),
  ]

  const canonical = parts.join('|')
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32)
}
