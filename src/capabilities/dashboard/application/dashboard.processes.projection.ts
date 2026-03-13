import type { ProcessAggregatedStatus } from '~/modules/process/features/operational-projection/application/operationalSemantics'

export type DashboardProcessRecordProjection = {
  readonly id: string
  readonly reference?: string | null
  readonly origin?: string | null
  readonly destination?: string | null
  readonly carrier?: string | null
  readonly createdAt?: Date | string | null
}

export type DashboardContainerRecordProjection = {
  readonly id: string
  readonly containerNumber: string
}

export type DashboardProcessWithContainersProjection = {
  readonly process: DashboardProcessRecordProjection
  readonly containers: readonly DashboardContainerRecordProjection[]
}

export type DashboardProcessOperationalSummaryProjection = {
  readonly process_status?: ProcessAggregatedStatus
  readonly eta?: string | null
  readonly full_logistics_complete?: boolean
  readonly alerts_count?: number
}

export type DashboardProcessSyncSummaryProjection = {
  readonly lastSyncAt: string | null
}

export type DashboardProcessWithOperationalSummaryProjection = {
  readonly pwc: DashboardProcessWithContainersProjection
  readonly summary: DashboardProcessOperationalSummaryProjection
  readonly sync?: DashboardProcessSyncSummaryProjection
}

export type DashboardProcessUseCases = {
  listProcessesWithOperationalSummary(): Promise<{
    readonly processes: readonly DashboardProcessWithOperationalSummaryProjection[]
  }>
}
