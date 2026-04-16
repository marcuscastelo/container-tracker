import type { AgentSyncJob } from '@agent/core/contracts/sync-job.contract'
import { toBackendSyncAck } from '@agent/sync/sync-job.mapper'

export function ackSyncResult(command: {
  readonly job: AgentSyncJob
  readonly snapshotId: string
  readonly occurredAt: string
  readonly newObservationsCount: number | null
  readonly newAlertsCount: number | null
}): ReturnType<typeof toBackendSyncAck> {
  return toBackendSyncAck({
    job: command.job,
    snapshotId: command.snapshotId,
    occurredAt: command.occurredAt,
    newObservationsCount: command.newObservationsCount,
    newAlertsCount: command.newAlertsCount,
  })
}
