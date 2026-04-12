import type { ProcessAggregatedStatus } from '~/modules/process/features/operational-projection/application/operationalSemantics'
import type { TemporalValueDto } from '~/shared/time/dto'
import type { Instant } from '~/shared/time/instant'

export type DashboardProcessRecordProjection = {
  readonly id: string
  readonly reference?: string | null
  readonly origin?: string | null
  readonly destination?: string | null
  readonly carrier?: string | null
  readonly createdAt?: Instant | string | null
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
  readonly eta?: TemporalValueDto | null
  readonly full_logistics_complete?: boolean
  readonly operational_incidents?: {
    readonly summary: {
      readonly active_incidents_count: number
      readonly affected_containers_count: number
      readonly recognized_incidents_count: number
    }
    readonly dominant: {
      readonly type:
        | 'TRANSSHIPMENT'
        | 'PLANNED_TRANSSHIPMENT'
        | 'CUSTOMS_HOLD'
        | 'PORT_CHANGE'
        | 'ETA_PASSED'
        | 'ETA_MISSING'
        | 'DATA_INCONSISTENT'
      readonly severity: 'info' | 'warning' | 'danger'
      readonly fact: {
        readonly messageKey:
          | 'incidents.fact.transshipmentDetected'
          | 'incidents.fact.plannedTransshipmentDetected'
          | 'incidents.fact.customsHoldDetected'
          | 'incidents.fact.etaPassed'
          | 'incidents.fact.etaMissing'
          | 'incidents.fact.portChange'
          | 'incidents.fact.dataInconsistent'
        readonly messageParams: Record<string, string | number>
      }
      readonly triggeredAt: string
    } | null
  }
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
