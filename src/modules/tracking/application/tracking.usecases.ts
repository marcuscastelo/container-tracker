import type { PipelineResult } from '~/modules/tracking/application/orchestration/pipeline'
import type { TrackingOperationalSummary } from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import type { TrackingSearchProjection } from '~/modules/tracking/application/projection/tracking.search.readmodel'
import {
  type FetchAndProcessResult,
  fetchAndProcess,
} from '~/modules/tracking/application/usecases/fetch-and-process.usecase'
import {
  type FindContainersHotReadProjectionCommand,
  type FindContainersHotReadProjectionResult,
  findContainersHotReadProjection,
} from '~/modules/tracking/application/usecases/find-containers-hot-read-projection.usecase'
import {
  type FindContainersOperationalSummaryProjectionCommand,
  findContainersOperationalSummaryProjection as findContainersOperationalSummaryProjectionUseCase,
} from '~/modules/tracking/application/usecases/find-containers-operational-summary-projection.usecase'
import {
  findContainersRecognizedAlertIncidentsProjection,
  findObservationInspectorProjection,
  findTimelineItemPredictionHistory,
} from '~/modules/tracking/application/usecases/find-lazy-tracking-detail.usecases'
import {
  type GetContainerSummaryResult,
  getContainerSummary,
} from '~/modules/tracking/application/usecases/get-container-summary.usecase'
import {
  type ContainerSyncRecord,
  createGetContainersSyncMetadataUseCase,
  type GetContainersSyncMetadataCommand,
} from '~/modules/tracking/application/usecases/get-containers-sync-metadata.usecase'
import { getLatestSnapshot } from '~/modules/tracking/application/usecases/get-latest-snapshot.usecase'
import { getSnapshotsForContainer } from '~/modules/tracking/application/usecases/get-snapshots-for-container.usecase'
import {
  type ListActiveAlertsByContainerIdResult,
  listActiveAlertsByContainerId,
} from '~/modules/tracking/application/usecases/list-active-alerts-by-container-id.usecase'
import { saveAndProcess } from '~/modules/tracking/application/usecases/save-and-process.usecase'
import { searchTrackingByDerivedStatusText } from '~/modules/tracking/application/usecases/search-tracking-by-derived-status-text.usecase'
import { searchTrackingByVesselName } from '~/modules/tracking/application/usecases/search-tracking-by-vessel-name.usecase'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { Provider } from '~/modules/tracking/domain/model/provider'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import { acknowledgeAlert } from '~/modules/tracking/features/alerts/application/usecases/acknowledge-alert.usecase'
import {
  type ListActiveAlertReadModelResult,
  listActiveAlertReadModel,
} from '~/modules/tracking/features/alerts/application/usecases/list-active-alert-read-model.usecase'
import { unacknowledgeAlert } from '~/modules/tracking/features/alerts/application/usecases/unacknowledge-alert.usecase'
import type { TrackingAlertAckSource } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import {
  type GetTrackingReplayDebugCommand,
  getTrackingReplayDebug,
} from '~/modules/tracking/features/replay/application/get-tracking-replay-debug.usecase'
import {
  type GetTrackingTimeTravelCommand,
  getTrackingTimeTravel,
} from '~/modules/tracking/features/replay/application/get-tracking-time-travel.usecase'
import type {
  TrackingReplayDebugResult,
  TrackingTimeTravelResult,
} from '~/modules/tracking/features/replay/application/tracking.replay.types'
import { systemClock } from '~/shared/time/clock'
import type { Instant } from '~/shared/time/instant'

/**
 * Backward-compatible result shape for fetchAndProcess.
 *
 * Callers currently check `if (!result)` to detect the no-fetcher case.
 * The internal use case returns a discriminated union, but the facade
 * maps it back to `{ snapshot, pipeline } | null` for minimal diff.
 */
type FetchAndProcessFacadeResult = {
  readonly snapshot: Snapshot
  readonly pipeline: PipelineResult
} | null

/**
 * Creates the tracking use cases facade with injected dependencies.
 *
 * This facade delegates to individual use case functions in `usecases/`.
 * It preserves the same public API as before (minimal diff for callers).
 *
 * After saving snapshots, the full pipeline is executed:
 *   snapshot → normalize → diff → persist observations → derive timeline/status/alerts → persist alerts
 */
export function createTrackingUseCases(deps: TrackingUseCasesDeps) {
  const getContainersSyncMetadata = createGetContainersSyncMetadataUseCase({
    syncMetadataRepository: deps.syncMetadataRepository,
  })

  return {
    /**
     * Fetch tracking data from a REST-based carrier, save as snapshot, and run the full pipeline.
     *
     * @returns The persisted Snapshot + pipeline result, or null if the carrier has no REST fetcher
     */
    async fetchAndProcess(
      containerId: string,
      containerNumber: string,
      provider: Provider,
    ): Promise<FetchAndProcessFacadeResult> {
      const result: FetchAndProcessResult = await fetchAndProcess(deps, {
        containerId,
        containerNumber,
        provider,
      })

      if (result.kind === 'no_fetcher') {
        return null
      }

      // Both 'ok' and 'fetch_failed' carry snapshot + pipeline
      return { snapshot: result.snapshot, pipeline: result.pipeline }
    },

    /**
     * Save a pre-fetched payload as a snapshot and run the full pipeline.
     */
    async saveAndProcess(
      containerId: string,
      containerNumber: string,
      provider: Provider,
      payload: unknown,
      parseError: string | null = null,
      fetchedAt?: string,
    ): Promise<{ readonly snapshot: Snapshot; readonly pipeline: PipelineResult }> {
      return saveAndProcess(deps, {
        containerId,
        containerNumber,
        provider,
        payload,
        parseError,
        ...(fetchedAt === undefined ? {} : { fetchedAt }),
      })
    },

    /**
     * Get the full tracking summary for a container (observations, timeline, status, alerts).
     */
    async getContainerSummary(
      containerId: string,
      containerNumber: string,
      podLocationCode?: string | null,
      now: Instant = systemClock.now(),
      options?: { readonly includeAcknowledgedAlerts?: boolean },
    ): Promise<GetContainerSummaryResult> {
      return getContainerSummary(deps, {
        containerId,
        containerNumber,
        now,
        includeAcknowledgedAlerts: options?.includeAcknowledgedAlerts ?? false,
        ...(podLocationCode === undefined ? {} : { podLocationCode }),
      })
    },

    /**
     * Get canonical operational summaries for multiple containers using the
     * batch hot-read projection path.
     */
    async findContainersOperationalSummaryProjection(
      command: FindContainersOperationalSummaryProjectionCommand,
    ): Promise<Map<string, TrackingOperationalSummary>> {
      return findContainersOperationalSummaryProjectionUseCase(deps, command)
    },

    /**
     * Get the canonical hot-read projection for shipment detail and process list.
     */
    async findContainersHotReadProjection(
      command: FindContainersHotReadProjectionCommand,
    ): Promise<FindContainersHotReadProjectionResult> {
      return findContainersHotReadProjection(deps, command)
    },

    async findTimelineItemPredictionHistory(command: {
      readonly containerId: string
      readonly timelineItemId: string
      readonly now?: Instant
    }) {
      return findTimelineItemPredictionHistory(deps, {
        containerId: command.containerId,
        timelineItemId: command.timelineItemId,
        now: command.now ?? systemClock.now(),
      })
    },

    async findObservationInspectorProjection(command: {
      readonly containerId: string
      readonly observationId: string
    }) {
      return findObservationInspectorProjection(deps, command)
    },

    async findContainersRecognizedAlertIncidentsProjection(command: {
      readonly containers: readonly {
        readonly containerId: string
        readonly containerNumber: string
      }[]
    }) {
      return findContainersRecognizedAlertIncidentsProjection(deps, command)
    },

    /**
     * List operational sync metadata for containers.
     *
     * This read model is operational-only and does not affect tracking semantics.
     */
    async getContainersSyncMetadata(
      command: GetContainersSyncMetadataCommand,
    ): Promise<readonly ContainerSyncRecord[]> {
      return getContainersSyncMetadata(command)
    },

    /**
     * Search tracking read models by vessel name (case-insensitive partial).
     */
    async searchByVesselName(
      query: string,
      limit: number,
    ): Promise<readonly TrackingSearchProjection[]> {
      return searchTrackingByVesselName(deps, { query, limit, now: systemClock.now() })
    },

    /**
     * Search tracking read models by derived status text (case-insensitive exact).
     */
    async searchByDerivedStatusText(
      query: string,
      limit: number,
    ): Promise<readonly TrackingSearchProjection[]> {
      return searchTrackingByDerivedStatusText(deps, { query, limit, now: systemClock.now() })
    },

    /**
     * Acknowledge a tracking alert.
     */
    async acknowledgeAlert(
      alertId: string,
      metadata?: {
        readonly ackedBy: string | null
        readonly ackedSource: TrackingAlertAckSource | null
      },
    ): Promise<void> {
      await acknowledgeAlert(deps, {
        alertId,
        ackedAt: systemClock.now().toIsoString(),
        ackedBy: metadata?.ackedBy ?? null,
        ackedSource: metadata?.ackedSource ?? null,
      })
    },

    /**
     * Mark an acknowledged alert as active again.
     */
    async unacknowledgeAlert(alertId: string): Promise<void> {
      await unacknowledgeAlert(deps, { alertId })
    },

    /**
     * Get all snapshots for a container.
     */
    async getSnapshotsForContainer(containerId: string): Promise<readonly Snapshot[]> {
      return getSnapshotsForContainer(deps, { containerId })
    },

    /**
     * Get the latest snapshot for a container.
     */
    async getLatestSnapshot(containerId: string): Promise<Snapshot | null> {
      return getLatestSnapshot(deps, { containerId })
    },

    async getTrackingTimeTravel(
      command: GetTrackingTimeTravelCommand,
    ): Promise<TrackingTimeTravelResult> {
      return getTrackingTimeTravel(deps, command)
    },

    async getTrackingReplayDebug(
      command: GetTrackingReplayDebugCommand,
    ): Promise<TrackingReplayDebugResult> {
      return getTrackingReplayDebug(deps, command)
    },

    /**
     * List active (non-acked) alerts for a container.
     *
     * Use this instead of getContainerSummary when only alerts are needed.
     */
    async listActiveAlertsByContainerId(
      containerId: string,
    ): Promise<ListActiveAlertsByContainerIdResult> {
      return listActiveAlertsByContainerId(deps, { containerId })
    },

    /**
     * List global active alerts read model for operational dashboards.
     */
    async listActiveAlertReadModel(): Promise<ListActiveAlertReadModelResult> {
      return listActiveAlertReadModel(deps)
    },
  }
}

export type TrackingUseCases = ReturnType<typeof createTrackingUseCases>
