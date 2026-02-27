import type { PipelineResult } from '~/modules/tracking/application/orchestration/pipeline'
import type { TrackingOperationalSummary } from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import { acknowledgeAlert } from '~/modules/tracking/application/usecases/acknowledge-alert.usecase'
import { dismissAlert } from '~/modules/tracking/application/usecases/dismiss-alert.usecase'
import {
  type FetchAndProcessResult,
  fetchAndProcess,
} from '~/modules/tracking/application/usecases/fetch-and-process.usecase'
import {
  type GetContainerSummaryResult,
  getContainerSummary,
} from '~/modules/tracking/application/usecases/get-container-summary.usecase'
import {
  type GetContainersSummaryCommand,
  getContainersSummary as getContainersSummaryUseCase,
} from '~/modules/tracking/application/usecases/get-containers-summary.usecase'
import { getLatestSnapshot } from '~/modules/tracking/application/usecases/get-latest-snapshot.usecase'
import { getSnapshotsForContainer } from '~/modules/tracking/application/usecases/get-snapshots-for-container.usecase'
import {
  type ListActiveAlertsByContainerIdResult,
  listActiveAlertsByContainerId,
} from '~/modules/tracking/application/usecases/list-active-alerts-by-container-id.usecase'
import { saveAndProcess } from '~/modules/tracking/application/usecases/save-and-process.usecase'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { Provider } from '~/modules/tracking/domain/model/provider'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'

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
    ): Promise<{ readonly snapshot: Snapshot; readonly pipeline: PipelineResult }> {
      return saveAndProcess(deps, {
        containerId,
        containerNumber,
        provider,
        payload,
        parseError,
      })
    },

    /**
     * Get the full tracking summary for a container (observations, timeline, status, alerts).
     */
    async getContainerSummary(
      containerId: string,
      containerNumber: string,
    ): Promise<GetContainerSummaryResult> {
      return getContainerSummary(deps, { containerId, containerNumber })
    },

    /**
     * Get operational summaries for multiple containers with partial-success behavior.
     *
     * Containers that fail due infra issues are returned with dataIssue=true
     * so callers can keep rendering uncertainty explicitly.
     */
    async getContainersSummary(
      containers: GetContainersSummaryCommand['containers'],
      now: Date = new Date(),
    ): Promise<Map<string, TrackingOperationalSummary>> {
      return getContainersSummaryUseCase(deps, { containers, now })
    },

    /**
     * Acknowledge a tracking alert.
     */
    async acknowledgeAlert(alertId: string): Promise<void> {
      await acknowledgeAlert(deps, { alertId, ackedAt: new Date().toISOString() })
    },

    /**
     * Dismiss a tracking alert.
     */
    async dismissAlert(alertId: string): Promise<void> {
      await dismissAlert(deps, { alertId, dismissedAt: new Date().toISOString() })
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

    /**
     * List active (non-acked, non-dismissed) alerts for a container.
     *
     * Use this instead of getContainerSummary when only alerts are needed.
     */
    async listActiveAlertsByContainerId(
      containerId: string,
    ): Promise<ListActiveAlertsByContainerIdResult> {
      return listActiveAlertsByContainerId(deps, { containerId })
    },
  }
}

export type TrackingUseCases = ReturnType<typeof createTrackingUseCases>
