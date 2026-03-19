import type { GetSyncStatusResult } from '~/capabilities/sync/application/usecases/get-sync-status.usecase'
import type { RefreshProcessResult } from '~/capabilities/sync/application/usecases/refresh-process.usecase'

export function toSyncAllProcessesResponse(result: {
  readonly syncedProcesses: number
  readonly syncedContainers: number
}) {
  return {
    ok: true as const,
    syncedProcesses: result.syncedProcesses,
    syncedContainers: result.syncedContainers,
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

export function toDetectProcessCarrierResponse(result: {
  readonly detected: boolean
  readonly carrier: string | null
  readonly runId?: string | null
  readonly status?: 'RESOLVED' | 'FAILED' | 'RATE_LIMITED' | null
  readonly resolvedProvider?: string | null
  readonly confidence?: 'HIGH' | 'LOW' | 'UNKNOWN' | null
  readonly attempts?: readonly {
    readonly provider: string
    readonly status: 'FOUND' | 'NOT_FOUND' | 'ERROR'
    readonly errorCode: string | null
  }[]
}) {
  return {
    detected: result.detected,
    carrier: result.carrier,
    run_id: result.runId ?? null,
    status: result.status ?? null,
    resolved_provider: result.resolvedProvider ?? null,
    confidence: result.confidence ?? null,
    attempts: (result.attempts ?? []).map((attempt) => ({
      provider: attempt.provider,
      status: attempt.status,
      error_code: attempt.errorCode,
    })),
  }
}
