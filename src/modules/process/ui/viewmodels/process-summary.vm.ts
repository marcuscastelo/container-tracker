import type { ProcessStatusCode } from '~/modules/process/ui/process-status-color'
import type { ProcessStatusMicrobadgeVM } from '~/modules/process/ui/viewmodels/process-status-microbadge.vm'
import type { TemporalValueDto } from '~/shared/time/dto'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

export type ProcessSyncStatus = 'idle' | 'syncing' | 'success' | 'error'

export type ProcessSummaryVM = {
  readonly id: string
  readonly reference: string | null
  readonly origin?: { display_name?: string | null } | null
  readonly destination?: { display_name?: string | null } | null
  readonly importerId: string | null
  readonly importerName: string | null
  readonly exporterName: string | null
  readonly containerCount: number
  readonly containerNumbers: readonly string[]
  readonly status: StatusVariant
  readonly statusCode: ProcessStatusCode
  readonly statusMicrobadge: ProcessStatusMicrobadgeVM | null
  readonly statusRank: number
  readonly eta: TemporalValueDto | null
  readonly etaMsOrNull: number | null
  readonly carrier: string | null
  readonly alertsCount: number
  readonly highestAlertSeverity: 'info' | 'warning' | 'danger' | null
  readonly dominantAlertCreatedAt: string | null
  readonly redestinationNumber?: string | null
  readonly hasTransshipment: boolean
  readonly lastEventAt: TemporalValueDto | null
  readonly syncStatus: ProcessSyncStatus
  readonly lastSyncAt: string | null
}
