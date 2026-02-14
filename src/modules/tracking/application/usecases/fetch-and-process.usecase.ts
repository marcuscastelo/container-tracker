import {
  type PipelineResult,
  processSnapshot,
} from '~/modules/tracking/application/pipeline/pipeline'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { Provider } from '~/modules/tracking/domain/provider'
import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/snapshot'
import type { FetchResult } from '~/modules/tracking/infrastructure/fetchers/msc.fetcher'
import { getRestFetcher } from '~/modules/tracking/infrastructure/fetchers/rest.fetchers'

/**
 * Command to fetch tracking data from a carrier and run the full pipeline.
 */
export type FetchAndProcessCommand = {
  readonly containerId: string
  readonly containerNumber: string
  readonly provider: Provider
}

/**
 * Discriminated union result for fetch-and-process.
 *
 * - `no_fetcher`: carrier has no REST fetcher (e.g. Maersk requires Puppeteer)
 * - `ok`: fetch + pipeline succeeded
 * - `fetch_failed`: fetch threw, but we persisted an error snapshot and ran the pipeline anyway
 */
export type FetchAndProcessResult =
  | { readonly kind: 'no_fetcher' }
  | { readonly kind: 'ok'; readonly snapshot: Snapshot; readonly pipeline: PipelineResult }
  | {
      readonly kind: 'fetch_failed'
      readonly snapshot: Snapshot
      readonly pipeline: PipelineResult
      readonly errorMessage: string
    }

/**
 * Fetch tracking data from a REST-based carrier, save as snapshot, and run the full pipeline.
 *
 * If the carrier has no REST fetcher, returns `{ kind: 'no_fetcher' }`.
 * If the fetch fails, persists an error snapshot (for audit) and returns `{ kind: 'fetch_failed' }`.
 */
export async function fetchAndProcess(
  deps: TrackingUseCasesDeps,
  cmd: FetchAndProcessCommand,
): Promise<FetchAndProcessResult> {
  const { snapshotRepository, observationRepository, trackingAlertRepository } = deps
  const pipelineDeps = { snapshotRepository, observationRepository, trackingAlertRepository }

  const fetcher = getRestFetcher(cmd.provider)
  if (!fetcher) {
    return { kind: 'no_fetcher' }
  }

  let fetchResult: FetchResult
  try {
    fetchResult = await fetcher(cmd.containerNumber)
  } catch (err) {
    // Save an error snapshot so we have a record of the failure.
    // payload must be non-null (DB constraint), so we store an error marker object.
    const errorMessage = err instanceof Error ? err.message : String(err)
    const errorSnapshot: NewSnapshot = {
      container_id: cmd.containerId,
      provider: cmd.provider,
      fetched_at: new Date().toISOString(),
      payload: { _error: true, message: errorMessage },
      parse_error: `Fetch failed: ${errorMessage}`,
    }
    const snapshot = await snapshotRepository.insert(errorSnapshot)
    const pipeline = await processSnapshot(
      snapshot,
      cmd.containerId,
      cmd.containerNumber,
      pipelineDeps,
      false,
    )
    return { kind: 'fetch_failed', snapshot, pipeline, errorMessage }
  }

  const newSnapshot: NewSnapshot = {
    container_id: cmd.containerId,
    provider: fetchResult.provider,
    fetched_at: fetchResult.fetchedAt,
    payload: fetchResult.payload,
    parse_error: null,
  }

  const snapshot = await snapshotRepository.insert(newSnapshot)
  const pipeline = await processSnapshot(
    snapshot,
    cmd.containerId,
    cmd.containerNumber,
    pipelineDeps,
    false,
  )

  return { kind: 'ok', snapshot, pipeline }
}
