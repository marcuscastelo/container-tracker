import type { GetSyncStatusResult } from '~/capabilities/sync/application/usecases/get-sync-status.usecase'
import type { RefreshProcessResult } from '~/capabilities/sync/application/usecases/refresh-process.usecase'
import type { SyncDashboardBatchResult } from '~/capabilities/sync/application/usecases/sync-dashboard-batch-result'

function toSyncDashboardBatchPayload(result: SyncDashboardBatchResult) {
  return {
    summary: {
      requestedProcesses: result.summary.requestedProcesses,
      requestedContainers: result.summary.requestedContainers,
      enqueued: result.summary.enqueued,
      skipped: result.summary.skipped,
      failed: result.summary.failed,
    },
    enqueuedTargets: result.enqueuedTargets.map((target) => ({
      processId: target.processId,
      processReference: target.processReference,
      containerNumber: target.containerNumber,
      provider: target.provider,
      syncRequestId: target.syncRequestId,
    })),
    skippedTargets: result.skippedTargets.map((target) => ({
      processId: target.processId,
      processReference: target.processReference,
      containerNumber: target.containerNumber,
      provider: target.provider,
      reasonCode: target.reasonCode,
      reasonMessage: target.reasonMessage,
    })),
    failedTargets: result.failedTargets.map((target) => ({
      processId: target.processId,
      processReference: target.processReference,
      containerNumber: target.containerNumber,
      provider: target.provider,
      reasonCode: target.reasonCode,
      reasonMessage: target.reasonMessage,
    })),
  }
}

export function toSyncAllProcessesSuccessResponse(result: SyncDashboardBatchResult) {
  return {
    ok: true as const,
    ...toSyncDashboardBatchPayload(result),
  }
}

export function toSyncAllProcessesBusinessErrorResponse(
  result: SyncDashboardBatchResult,
  error: string,
) {
  return {
    ok: false as const,
    error,
    ...toSyncDashboardBatchPayload(result),
  }
}

export function toSyncProcessResponse(result: {
  readonly processId: string
  readonly syncedContainers: number
}) {
  return {
    ok: true as const,
    processId: result.processId,
    syncedContainers: result.syncedContainers,
  }
}

export function toSyncContainerResponse(result: {
  readonly containerNumber: string
  readonly syncedContainers: number
}) {
  return {
    ok: true as const,
    containerNumber: result.containerNumber,
    syncedContainers: result.syncedContainers,
  }
}

function toProcessSyncStateResponse(process: GetSyncStatusResult['processes'][number]) {
  return {
    process_id: process.processId,
    sync_status: process.syncStatus,
    started_at: process.startedAt,
    finished_at: process.finishedAt,
    container_count: process.containerCount,
    completed_containers: process.completedContainers,
    failed_containers: process.failedContainers,
    visibility: process.visibility,
  }
}

export function toProcessesSyncStatusResponse(result: GetSyncStatusResult) {
  return {
    generated_at: result.generatedAt,
    processes: result.processes.map(toProcessSyncStateResponse),
  }
}

export function toProcessRefreshResponse(result: RefreshProcessResult) {
  return {
    ok: true as const,
    processId: result.processId,
    mode: result.mode,
    requestedContainers: result.requestedContainers,
    queuedContainers: result.queuedContainers,
    syncRequestIds: [...result.syncRequestIds],
    requests: result.requests.map((request) => ({
      container_number: request.containerNumber,
      sync_request_id: request.syncRequestId,
      deduped: request.deduped,
    })),
    failures: result.failures.map((failure) => ({
      container_number: failure.containerNumber,
      error: failure.error,
    })),
  }
}
