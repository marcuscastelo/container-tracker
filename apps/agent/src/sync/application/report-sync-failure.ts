import type { AgentSyncJob } from '@agent/core/contracts/sync-job.contract'
import { toBackendSyncFailure } from '@agent/sync/sync-job.mapper'

export function reportSyncFailure(command: {
  readonly job: AgentSyncJob
  readonly errorMessage: string
  readonly occurredAt: string
  readonly snapshotId: string | null
}): ReturnType<typeof toBackendSyncFailure> {
  return toBackendSyncFailure({
    job: command.job,
    errorMessage: command.errorMessage,
    occurredAt: command.occurredAt,
    snapshotId: command.snapshotId,
  })
}
