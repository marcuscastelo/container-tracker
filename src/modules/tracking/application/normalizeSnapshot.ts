import type { ObservationDraft } from '~/modules/tracking/domain/observationDraft'
import type { Provider } from '~/modules/tracking/domain/provider'
import type { Snapshot } from '~/modules/tracking/domain/snapshot'
import { normalizeMscSnapshot } from '~/modules/tracking/infrastructure/adapters/mscNormalizer'

/**
 * Registry of provider normalizers.
 *
 * Each provider has a normalizer function that converts a Snapshot
 * into ObservationDrafts. Add new providers here as they are integrated.
 */
const NORMALIZERS: Record<Provider, (snapshot: Snapshot) => ObservationDraft[]> = {
  msc: normalizeMscSnapshot,

  // TODO: Implement Maersk normalizer (reuse existing maersk.adapter.ts logic)
  maersk: (_snapshot) => {
    // Placeholder — will be implemented when Maersk adapter is wired.
    return []
  },

  // TODO: Implement CMA-CGM normalizer (reuse existing cmacgm.adapter.ts logic)
  cmacgm: (_snapshot) => {
    // Placeholder — will be implemented when CMA-CGM adapter is wired.
    return []
  },

  // TODO: Implement remaining provider normalizers
  hapag: (_snapshot) => [],
  one: (_snapshot) => [],
  evergreen: (_snapshot) => [],
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
