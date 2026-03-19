import type { ProcessStatusCode } from '~/modules/process/ui/process-status-color'
import type { TemporalValueDto } from '~/shared/time/dto'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

export type DashboardProcessExceptionSeverity = 'danger' | 'warning' | 'info' | 'success' | 'none'

export type DashboardProcessExceptionVM = {
  readonly processId: string
  readonly reference: string | null
  readonly origin: string | null
  readonly destination: string | null
  readonly statusCode: ProcessStatusCode
  readonly status: StatusVariant
  readonly etaCurrent: TemporalValueDto | null
  readonly dominantSeverity: DashboardProcessExceptionSeverity
  readonly activeAlertCount: number
  readonly dominantAlertCreatedAt: string | null
}
