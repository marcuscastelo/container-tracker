import type { ProcessStatusCode } from '~/modules/process/ui/process-status-color'
import type { TemporalValueDto } from '~/shared/time/dto'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

export type DashboardProcessExceptionSeverity = 'danger' | 'warning' | 'info' | 'success' | 'none'

export type DashboardProcessExceptionIncidentVM = {
  readonly type:
    | 'TRANSSHIPMENT'
    | 'PLANNED_TRANSSHIPMENT'
    | 'CUSTOMS_HOLD'
    | 'PORT_CHANGE'
    | 'ETA_PASSED'
    | 'ETA_MISSING'
    | 'DATA_INCONSISTENT'
  readonly severity: 'info' | 'warning' | 'danger'
  readonly factMessageKey: string
  readonly factMessageParams: Record<string, string | number>
  readonly triggeredAt: string
}

export type DashboardProcessExceptionVM = {
  readonly processId: string
  readonly reference: string | null
  readonly origin: string | null
  readonly destination: string | null
  readonly statusCode: ProcessStatusCode
  readonly status: StatusVariant
  readonly etaCurrent: TemporalValueDto | null
  readonly dominantSeverity: DashboardProcessExceptionSeverity
  readonly activeIncidentCount: number
  readonly affectedContainerCount: number
  readonly dominantIncident: DashboardProcessExceptionIncidentVM | null
}
