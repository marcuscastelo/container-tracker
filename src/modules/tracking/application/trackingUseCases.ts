import { type PipelineResult, processSnapshot } from '~/modules/tracking/application/pipeline'
import type { ContainerStatus } from '~/modules/tracking/domain/containerStatus'
import { deriveTransshipment } from '~/modules/tracking/domain/deriveAlerts'
import { deriveStatus } from '~/modules/tracking/domain/deriveStatus'
import { deriveTimeline } from '~/modules/tracking/domain/deriveTimeline'
import type { Observation } from '~/modules/tracking/domain/observation'
import type { ObservationRepository } from '~/modules/tracking/domain/observationRepository'
import type { Provider } from '~/modules/tracking/domain/provider'
import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/snapshot'
import type { SnapshotRepository } from '~/modules/tracking/domain/snapshotRepository'
import type { Timeline } from '~/modules/tracking/domain/timeline'
import type { TrackingAlert } from '~/modules/tracking/domain/trackingAlert'
import type { TrackingAlertRepository } from '~/modules/tracking/domain/trackingAlertRepository'
import type { TransshipmentInfo } from '~/modules/tracking/domain/transshipment'
import type { FetchResult } from '~/modules/tracking/infrastructure/fetchers/mscFetcher'
import { getRestFetcher } from '~/modules/tracking/infrastructure/fetchers/restFetchers'

/**
 * Dependencies for tracking use cases.
 */
type TrackingUseCasesDeps = {
  readonly snapshotRepository: SnapshotRepository
  readonly observationRepository: ObservationRepository
  readonly trackingAlertRepository: TrackingAlertRepository
}

/**
 * Result of a fetch-and-process operation.
 */
type FetchAndProcessResult = {
  readonly snapshot: Snapshot
  readonly pipeline: PipelineResult
}

/**
 * Container tracking summary — derived data for a single container.
 */
type ContainerTrackingSummary = {
  readonly containerId: string
  readonly containerNumber: string
  readonly observations: readonly Observation[]
  readonly timeline: Timeline
  readonly status: ContainerStatus
  readonly transshipment: TransshipmentInfo
  readonly alerts: readonly TrackingAlert[]
}

/**
 * Creates the tracking use cases with injected dependencies.
 *
 * After saving snapshots, the full pipeline is executed:
 *   snapshot → normalize → diff → persist observations → derive timeline/status/alerts → persist alerts
 */
export function createTrackingUseCases(deps: TrackingUseCasesDeps) {
  const { snapshotRepository, observationRepository, trackingAlertRepository } = deps

  const pipelineDeps = { snapshotRepository, observationRepository, trackingAlertRepository }

  /**
   * Run the pipeline on a persisted snapshot.
   */
  async function runPipeline(
    snapshot: Snapshot,
    containerId: string,
    containerNumber: string,
    isBackfill: boolean = false,
  ): Promise<PipelineResult> {
    return processSnapshot(snapshot, containerId, containerNumber, pipelineDeps, isBackfill)
  }

  return {
    /**
     * Fetch tracking data from a REST-based carrier, save as snapshot, and run the full pipeline.
     *
     * @param containerId - UUID of the container in our DB
     * @param containerNumber - The physical container number (e.g. MNBU3094033)
     * @param provider - Carrier identifier
     * @returns The persisted Snapshot + pipeline result, or null if the carrier has no REST fetcher
     */
    async fetchAndProcess(
      containerId: string,
      containerNumber: string,
      provider: Provider,
    ): Promise<FetchAndProcessResult | null> {
      const fetcher = getRestFetcher(provider)
      if (!fetcher) {
        return null
      }

      let fetchResult: FetchResult
      try {
        fetchResult = await fetcher(containerNumber)
      } catch (err) {
        // Save a snapshot with parse_error so we have a record of the failure.
        // payload must be non-null (DB constraint), so we store an error marker object.
        const errorMessage = err instanceof Error ? err.message : String(err)
        const errorSnapshot: NewSnapshot = {
          container_id: containerId,
          provider,
          fetched_at: new Date().toISOString(),
          payload: { _error: true, message: errorMessage },
          parse_error: `Fetch failed: ${errorMessage}`,
        }
        const snapRes = await snapshotRepository.insert(errorSnapshot)
        if (!snapRes.success) throw snapRes.error
        const snapshot = snapRes.data
        const pipeline = await runPipeline(snapshot, containerId, containerNumber)
        return { snapshot, pipeline }
      }

      const newSnapshot: NewSnapshot = {
        container_id: containerId,
        provider: fetchResult.provider,
        fetched_at: fetchResult.fetchedAt,
        payload: fetchResult.payload,
        parse_error: null,
      }

      const snapRes = await snapshotRepository.insert(newSnapshot)
      if (!snapRes.success) throw snapRes.error
      const snapshot = snapRes.data
      const pipeline = await runPipeline(snapshot, containerId, containerNumber)
      return { snapshot, pipeline }
    },

    /**
     * Save a pre-fetched payload as a snapshot and run the full pipeline.
     *
     * Used by Maersk (Puppeteer) flow where the fetch is done externally
     * and we just need to persist the captured JSON.
     *
     * @param containerId - UUID of the container in our DB
     * @param containerNumber - The physical container number
     * @param provider - Carrier identifier
     * @param payload - The raw API response to persist
     * @param parseError - Optional error message if parsing failed upstream
     * @returns The persisted Snapshot + pipeline result
     */
    async saveAndProcess(
      containerId: string,
      containerNumber: string,
      provider: Provider,
      payload: unknown,
      parseError: string | null = null,
    ): Promise<FetchAndProcessResult> {
      const newSnapshot: NewSnapshot = {
        container_id: containerId,
        provider,
        fetched_at: new Date().toISOString(),
        payload,
        parse_error: parseError,
      }

      const snapRes = await snapshotRepository.insert(newSnapshot)
      if (!snapRes.success) throw snapRes.error
      const snapshot = snapRes.data
      const pipeline = await runPipeline(snapshot, containerId, containerNumber)
      return { snapshot, pipeline }
    },

    /**
     * Get the full tracking summary for a container (observations, timeline, status, alerts).
     */
    async getContainerSummary(
      containerId: string,
      containerNumber: string,
    ): Promise<ContainerTrackingSummary> {
      const [obsRes, alertsRes] = await Promise.all([
        observationRepository.findAllByContainerId(containerId),
        trackingAlertRepository.findActiveByContainerId(containerId),
      ])

      if (!obsRes.success) throw obsRes.error
      if (!alertsRes.success) throw alertsRes.error

      const observations = obsRes.data
      const alerts = alertsRes.data

      const timeline = deriveTimeline(containerId, containerNumber, observations)
      const status = deriveStatus(timeline)
      const transshipment = deriveTransshipment(timeline)

      return {
        containerId,
        containerNumber,
        observations,
        timeline,
        status,
        transshipment,
        alerts,
      }
    },

    /**
     * Acknowledge a tracking alert.
     */
    async acknowledgeAlert(alertId: string): Promise<void> {
      const res = await trackingAlertRepository.acknowledge(alertId, new Date().toISOString())
      if (!res.success) throw res.error
      return
    },

    /**
     * Dismiss a tracking alert.
     */
    async dismissAlert(alertId: string): Promise<void> {
      const res = await trackingAlertRepository.dismiss(alertId, new Date().toISOString())
      if (!res.success) throw res.error
      return
    },

    /**
     * Get all snapshots for a container.
     */
    async getSnapshotsForContainer(containerId: string): Promise<readonly Snapshot[]> {
      const res = await snapshotRepository.findAllByContainerId(containerId)
      if (!res.success) throw res.error
      return res.data
    },

    /**
     * Get the latest snapshot for a container.
     */
    async getLatestSnapshot(containerId: string): Promise<Snapshot | null> {
      const res = await snapshotRepository.findLatestByContainerId(containerId)
      if (!res.success) throw res.error
      return res.data
    },
  }
}
