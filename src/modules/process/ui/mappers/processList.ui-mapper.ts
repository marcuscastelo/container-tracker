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
  reference?: string | null
  origin?: { display_name?: string | null } | null
  destination?: { display_name?: string | null } | null
  carrier?: string | null
  default_carrier_code?: string | null
  carrier_mode?: 'AUTO' | 'MANUAL'
  effective_carrier_summary?: 'UNKNOWN' | 'SINGLE' | 'MIXED'
  effective_carrier_codes?: readonly string[]
  importer_id?: string | null
  importer_name?: string | null
  exporter_name?: string | null
  bill_of_lading?: string | null
  booking_number?: string | null
  source: string
  created_at: string
  updated_at: string
  containers: Array<{
    id: string
    container_number: string
    carrier_code?: string | null
  }>
  process_status?: string | null
  status_microbadge?: {
    status?: string | null
    count?: number | null
  } | null
  eta?: TemporalValueDto | null
  alerts_count?: number
  highest_alert_severity?: 'info' | 'warning' | 'danger' | null
  dominant_alert_created_at?: string | null
  has_transshipment?: boolean
  last_event_at?: TemporalValueDto | null
  redestination_number?: string | null
  last_sync_status?: 'DONE' | 'FAILED' | 'RUNNING' | 'UNKNOWN'
  last_sync_at?: string | null
}

type EffectiveCarrierProjection = {
  readonly summary: 'UNKNOWN' | 'SINGLE' | 'MIXED'
  readonly label: string
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

function toEffectiveCarrierProjection(process: ProcessListItemSource): EffectiveCarrierProjection {
  const declaredCodes =
    process.effective_carrier_codes?.map((code) => toOptionalNonBlankString(code)) ?? []
  const normalizedDeclaredCodes = Array.from(
    new Set(
      declaredCodes
        .filter((code): code is string => code !== null)
        .map((code) => code.trim().toUpperCase()),
    ),
  )

  if (normalizedDeclaredCodes.length === 1) {
    return {
      summary: process.effective_carrier_summary ?? 'SINGLE',
      label: normalizedDeclaredCodes[0],
    }
  }

  if (normalizedDeclaredCodes.length > 1) {
    return {
      summary: process.effective_carrier_summary ?? 'MIXED',
      label: `${normalizedDeclaredCodes[0]} +${normalizedDeclaredCodes.length - 1}`,
    }
  }

  const nonBlankContainerCarriers = process.containers
    .map((container) => toOptionalNonBlankString(container.carrier_code))
    .filter((carrier): carrier is string => carrier !== null)

  const uniqueUpperContainerCarriers = Array.from(
    new Set(nonBlankContainerCarriers.map((carrier) => carrier.trim().toUpperCase())),
  )

  if (uniqueUpperContainerCarriers.length === 0) {
    return {
      summary: process.effective_carrier_summary ?? 'UNKNOWN',
      label: 'Unknown',
    }
  }

  if (uniqueUpperContainerCarriers.length === 1) {
    return {
      summary: 'SINGLE',
      label: uniqueUpperContainerCarriers[0],
    }
  }

  return {
    summary: 'MIXED',
    label: `${uniqueUpperContainerCarriers[0]} +${uniqueUpperContainerCarriers.length - 1}`,
  }
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

    const effectiveCarrier = toEffectiveCarrierProjection(process)

    return {
      id: process.id,
      reference: process.reference ?? null,
      origin: process.origin,
      destination: process.destination,
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
      carrier: toOptionalNonBlankString(process.default_carrier_code ?? process.carrier),
      carrierMode: process.carrier_mode,
      effectiveCarrierSummary: process.effective_carrier_summary ?? effectiveCarrier.summary,
      effectiveCarrierLabel: effectiveCarrier.label,
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
