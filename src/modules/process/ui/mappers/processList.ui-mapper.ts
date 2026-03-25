import {
  processStatusToRank,
  processStatusToVariant,
  toProcessStatusCode,
} from '~/modules/process/ui/mappers/processStatus.ui-mapper'
import { toProcessStatusMicrobadgeVM } from '~/modules/process/ui/mappers/processStatusMicrobadge.ui-mapper'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'
import { toComparableInstant } from '~/shared/time/compare-temporal'
import type { TemporalValueDto } from '~/shared/time/dto'
import { parseTemporalValue } from '~/shared/time/parsing'

export type ProcessListItemSource = {
  id: string
  reference?: string | null | undefined
  origin?: { display_name?: string | null | undefined } | null | undefined
  destination?: { display_name?: string | null | undefined } | null | undefined
  carrier?: string | null | undefined
  importer_id?: string | null | undefined
  importer_name?: string | null | undefined
  exporter_name?: string | null | undefined
  bill_of_lading?: string | null | undefined
  booking_number?: string | null | undefined
  source: string
  created_at: string
  updated_at: string
  containers: Array<{
    id: string
    container_number: string
    carrier_code?: string | null | undefined
  }>
  process_status?: string | null | undefined
  status_microbadge?:
    | {
        status?: string | null | undefined
        count?: number | null | undefined
      }
    | null
    | undefined
  eta?: TemporalValueDto | null | undefined
  alerts_count?: number | undefined
  highest_alert_severity?: 'info' | 'warning' | 'danger' | null | undefined
  dominant_alert_created_at?: string | null | undefined
  has_transshipment?: boolean | undefined
  last_event_at?: TemporalValueDto | null | undefined
  redestination_number?: string | null | undefined
  last_sync_status?: 'DONE' | 'FAILED' | 'RUNNING' | 'UNKNOWN' | undefined
  last_sync_at?: string | null | undefined
}

function toOptionalNonBlankString(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? value : null
}

function normalizeContainerNumber(containerNumber: string): string {
  return containerNumber.trim().toUpperCase()
}

function toTimestampOrNull(value: TemporalValueDto | null | undefined): number | null {
  if (!value) return null
  const parsed = parseTemporalValue(value)
  if (parsed === null) return null
  return toComparableInstant(parsed, { timezone: 'UTC', strategy: 'start-of-day' }).toEpochMs()
}

function toOptionalLocationDisplay(
  value: ProcessListItemSource['origin'] | ProcessListItemSource['destination'],
): { display_name?: string | null } | null {
  if (value === null || value === undefined) return null
  return value.display_name === undefined ? {} : { display_name: value.display_name ?? null }
}

function toProcessSyncStatus(
  status: ProcessListItemSource['last_sync_status'],
): ProcessSummaryVM['syncStatus'] {
  // Success/error are intentionally ephemeral in dashboard realtime state.
  // After reload we only keep "syncing" when backend still reports active work.
  if (status === 'RUNNING') return 'syncing'
  return 'idle'
}

export function toProcessSummaryVMs(
  data: readonly ProcessListItemSource[],
): readonly ProcessSummaryVM[] {
  return data.map((process) => {
    const rawStatus = process.process_status ?? null
    const eta = process.eta ?? null
    const statusCode = toProcessStatusCode(rawStatus)
    const statusRank = processStatusToRank(statusCode)

    return {
      id: process.id,
      reference: process.reference ?? null,
      origin: toOptionalLocationDisplay(process.origin),
      destination: toOptionalLocationDisplay(process.destination),
      importerId: toOptionalNonBlankString(process.importer_id),
      importerName: toOptionalNonBlankString(process.importer_name),
      exporterName: toOptionalNonBlankString(process.exporter_name),
      containerCount: process.containers.length,
      containerNumbers: process.containers.map((container) =>
        normalizeContainerNumber(container.container_number),
      ),
      status: processStatusToVariant(statusCode),
      statusCode,
      statusMicrobadge: toProcessStatusMicrobadgeVM(process.status_microbadge),
      statusRank,
      eta,
      etaMsOrNull: toTimestampOrNull(eta),
      carrier: toOptionalNonBlankString(process.carrier),
      alertsCount: process.alerts_count ?? 0,
      highestAlertSeverity: process.highest_alert_severity ?? null,
      dominantAlertCreatedAt: process.dominant_alert_created_at ?? null,
      redestinationNumber: process.redestination_number ?? null,
      hasTransshipment: process.has_transshipment ?? false,
      lastEventAt: process.last_event_at ?? null,
      syncStatus: toProcessSyncStatus(process.last_sync_status),
      lastSyncAt: process.last_sync_at ?? null,
    }
  })
}
