import type {
  SyncAllProcessesBusinessErrorResponse,
  SyncAllProcessesRequestResult,
  SyncAllProcessesSuccessResponse,
} from '~/modules/process/ui/api/processSync.api'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'

type SyncAllProcessesPayload =
  | SyncAllProcessesSuccessResponse
  | SyncAllProcessesBusinessErrorResponse

export type DashboardSyncBatchReasonCode =
  | SyncAllProcessesPayload['skippedTargets'][number]['reasonCode']
  | SyncAllProcessesPayload['failedTargets'][number]['reasonCode']

export type DashboardSyncBatchIssueSeverity = 'warning' | 'danger'

export type DashboardSyncBatchEnqueuedTargetVM = {
  readonly processId: string
  readonly processReference: string | null
  readonly processLabel: string
  readonly containerNumber: string
  readonly provider: string
  readonly providerLabel: string
  readonly syncRequestId: string
}

export type DashboardSyncBatchProblemTargetVM = {
  readonly processId: string
  readonly processReference: string | null
  readonly processLabel: string
  readonly containerNumber: string
  readonly provider: string
  readonly providerLabel: string
  readonly reasonCode: DashboardSyncBatchReasonCode
  readonly reasonLabel: string
  readonly reasonMessage: string
}

export type DashboardProcessSyncIssueVM = {
  readonly severity: DashboardSyncBatchIssueSeverity
  readonly tooltip: string
  readonly failedCount: number
  readonly skippedCount: number
}

export type DashboardSyncBatchResultVM = {
  readonly httpStatus: SyncAllProcessesRequestResult['httpStatus']
  readonly tone: 'success' | 'warning' | 'danger'
  readonly isBusinessError: boolean
  readonly summary: {
    readonly requestedProcesses: number
    readonly requestedContainers: number
    readonly enqueued: number
    readonly skipped: number
    readonly failed: number
  }
  readonly enqueuedTargets: readonly DashboardSyncBatchEnqueuedTargetVM[]
  readonly skippedTargets: readonly DashboardSyncBatchProblemTargetVM[]
  readonly failedTargets: readonly DashboardSyncBatchProblemTargetVM[]
  readonly issueByProcessId: Readonly<Record<string, DashboardProcessSyncIssueVM>>
  readonly failedProcessIds: readonly string[]
  readonly enqueuedProcessIds: readonly string[]
}

export type DashboardProcessRowVM = ProcessSummaryVM & {
  readonly syncIssue: DashboardProcessSyncIssueVM | null
}
