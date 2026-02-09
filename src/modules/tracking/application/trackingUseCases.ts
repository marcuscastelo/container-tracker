import type { Provider } from '~/modules/tracking/domain/provider'
import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/snapshot'
import type { SnapshotRepository } from '~/modules/tracking/domain/snapshotRepository'
import { getRestFetcher } from '~/modules/tracking/infrastructure/fetchers'
import type { FetchResult } from '~/modules/tracking/infrastructure/fetchers/mscFetcher'

/**
 * Dependencies for tracking use cases.
 */
export type TrackingUseCasesDeps = {
  readonly snapshotRepository: SnapshotRepository
}

/**
 * Creates the tracking use cases with injected dependencies.
 *
 * Current scope (MVP):
 * - fetchAndSaveSnapshot: Fetch from carrier API and persist as snapshot
 * - saveRawSnapshot: Persist a pre-fetched payload as snapshot (for Maersk/Puppeteer)
 *
 * Future scope (when observations/alerts are wired):
 * - Will call processSnapshot pipeline after saving snapshot
 */
export function createTrackingUseCases(deps: TrackingUseCasesDeps) {
  const { snapshotRepository } = deps

  return {
    /**
     * Fetch tracking data from a REST-based carrier and save as snapshot.
     *
     * @param containerId - UUID of the container in our DB
     * @param containerNumber - The physical container number (e.g. MNBU3094033)
     * @param provider - Carrier identifier
     * @returns The persisted Snapshot, or null if the carrier has no REST fetcher
     */
    async fetchAndSaveSnapshot(
      containerId: string,
      containerNumber: string,
      provider: Provider,
    ): Promise<Snapshot | null> {
      const fetcher = getRestFetcher(provider)
      if (!fetcher) {
        return null
      }

      let fetchResult: FetchResult
      try {
        fetchResult = await fetcher(containerNumber)
      } catch (err) {
        // Save a snapshot with parse_error so we have a record of the failure
        const errorSnapshot: NewSnapshot = {
          container_id: containerId,
          provider,
          fetched_at: new Date().toISOString(),
          payload: null,
          parse_error: `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        }
        return snapshotRepository.insert(errorSnapshot)
      }

      const newSnapshot: NewSnapshot = {
        container_id: containerId,
        provider: fetchResult.provider,
        fetched_at: fetchResult.fetchedAt,
        payload: fetchResult.payload,
        parse_error: null,
      }

      return snapshotRepository.insert(newSnapshot)
    },

    /**
     * Save a pre-fetched payload as a snapshot.
     *
     * Used by Maersk (Puppeteer) flow where the fetch is done externally
     * and we just need to persist the captured JSON.
     *
     * @param containerId - UUID of the container in our DB
     * @param provider - Carrier identifier
     * @param payload - The raw API response to persist
     * @param parseError - Optional error message if parsing failed upstream
     * @returns The persisted Snapshot
     */
    async saveRawSnapshot(
      containerId: string,
      provider: Provider,
      payload: unknown,
      parseError: string | null = null,
    ): Promise<Snapshot> {
      const newSnapshot: NewSnapshot = {
        container_id: containerId,
        provider,
        fetched_at: new Date().toISOString(),
        payload,
        parse_error: parseError,
      }

      return snapshotRepository.insert(newSnapshot)
    },

    /**
     * Get all snapshots for a container.
     */
    async getSnapshotsForContainer(containerId: string): Promise<readonly Snapshot[]> {
      return snapshotRepository.findAllByContainerId(containerId)
    },

    /**
     * Get the latest snapshot for a container.
     */
    async getLatestSnapshot(containerId: string): Promise<Snapshot | null> {
      return snapshotRepository.findLatestByContainerId(containerId)
    },
  }
}

export type TrackingUseCases = ReturnType<typeof createTrackingUseCases>
