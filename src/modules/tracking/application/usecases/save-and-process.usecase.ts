import {
  type PipelineResult,
  processSnapshot,
} from '~/modules/tracking/application/orchestration/pipeline'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { Provider } from '~/modules/tracking/domain/model/provider'
import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/model/snapshot'

/**
 * Command to save a pre-fetched payload as a snapshot and run the full pipeline.
 *
 * Used by flows where the fetch is done externally (e.g. Maersk/Puppeteer)
 * and we just need to persist the captured JSON.
 */
export type SaveAndProcessCommand = {
  readonly containerId: string
  readonly containerNumber: string
  readonly provider: Provider
  readonly payload: unknown
  readonly parseError?: string | null
}

/**
 * Result of save-and-process — the persisted snapshot and pipeline derivations.
 */
export type SaveAndProcessResult = {
  readonly snapshot: Snapshot
  readonly pipeline: PipelineResult
}

/**
 * Save a pre-fetched payload as a snapshot and run the full derivation pipeline.
 */
export async function saveAndProcess(
  deps: TrackingUseCasesDeps,
  cmd: SaveAndProcessCommand,
): Promise<SaveAndProcessResult> {
  const { snapshotRepository, observationRepository, trackingAlertRepository } = deps
  const pipelineDeps = { snapshotRepository, observationRepository, trackingAlertRepository }

  const newSnapshot: NewSnapshot = {
    container_id: cmd.containerId,
    provider: cmd.provider,
    fetched_at: new Date().toISOString(),
    payload: cmd.payload,
    parse_error: cmd.parseError ?? null,
  }

  const snapshot = await snapshotRepository.insert(newSnapshot)
  const pipeline = await processSnapshot(
    snapshot,
    cmd.containerId,
    cmd.containerNumber,
    pipelineDeps,
    false,
  )

  return { snapshot, pipeline }
}
