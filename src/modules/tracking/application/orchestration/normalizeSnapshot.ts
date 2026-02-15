import type { ObservationDraft } from '~/modules/tracking/domain/model/observationDraft'
import type { Provider } from '~/modules/tracking/domain/model/provider'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import { normalizeCmaCgmSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/cmacgm.normalizer'
import { normalizeMaerskSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/maersk.normalizer'
import { normalizeMscSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/msc.normalizer'

/**
 * Registry of provider normalizers.
 *
 * Each provider has a normalizer function that converts a Snapshot
 * into ObservationDrafts. Add new providers here as they are integrated.
 */
const NORMALIZERS: Record<Provider, (snapshot: Snapshot) => ObservationDraft[]> = {
  msc: normalizeMscSnapshot,
  maersk: normalizeMaerskSnapshot,
  cmacgm: normalizeCmaCgmSnapshot,
}

/**
 * Normalize a snapshot into ObservationDrafts using the appropriate provider adapter.
 *
 * This is the single entry point for normalization in the pipeline.
 * It delegates to provider-specific normalizers.
 *
 * @param snapshot - Immutable snapshot record with raw payload
 * @returns Array of ObservationDraft — may be empty if payload invalid
 *
 * @see docs/master-consolidated-0209.md §4.1
 */
export function normalizeSnapshot(snapshot: Snapshot): ObservationDraft[] {
  const normalizer = NORMALIZERS[snapshot.provider]
  return normalizer(snapshot)
}
