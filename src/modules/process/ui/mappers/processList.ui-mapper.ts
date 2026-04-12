import {
  processStatusToRank,
  processStatusToVariant,
  toProcessStatusCode,
} from '~/modules/process/ui/mappers/processStatus.ui-mapper'
import { toProcessStatusMicrobadgeVM } from '~/modules/process/ui/mappers/processStatusMicrobadge.ui-mapper'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'
import type {
  ProcessTrackingValidationVM,
  TrackingValidationIssueVM,
} from '~/modules/process/ui/viewmodels/tracking-review.vm'
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
  eta_display?:
    | {
        readonly kind: 'date'
        readonly value: TemporalValueDto
      }
    | {
        readonly kind: 'arrived'
        readonly value: TemporalValueDto
      }
    | {
        readonly kind: 'unavailable'
      }
    | {
        readonly kind: 'delivered'
      }
    | undefined
  attention_severity?: 'info' | 'warning' | 'danger' | null | undefined
  operational_incidents?:
    | {
        readonly summary: {
          readonly active_incidents: number
          readonly affected_containers: number
          readonly recognized_incidents: number
        }
        readonly dominant:
          | {
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
                readonly message_key: string
                readonly message_params: Record<string, string | number>
              }
              readonly triggered_at: string
            }
          | null
          | undefined
      }
    | undefined
  tracking_validation?:
    | {
        readonly has_issues?: boolean | undefined
        readonly highest_severity?: 'info' | 'warning' | 'danger' | null | undefined
        readonly affected_container_count?: number | undefined
        readonly top_issue?:
          | {
              readonly code: string
              readonly severity: 'warning' | 'danger'
              readonly reason_key: string
              readonly affected_area:
                | 'container'
                | 'operational'
                | 'process'
                | 'series'
                | 'status'
                | 'timeline'
              readonly affected_location?: string | null | undefined
              readonly affected_block_label_key?: string | null | undefined
            }
          | null
          | undefined
      }
    | undefined
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

function toEtaDisplay(
  etaDisplay: ProcessListItemSource['eta_display'],
  eta: TemporalValueDto | null,
): ProcessSummaryVM['etaDisplay'] {
  if (etaDisplay?.kind === 'date' || etaDisplay?.kind === 'arrived') {
    return {
      kind: etaDisplay.kind,
      value: etaDisplay.value,
    }
  }

  if (etaDisplay?.kind === 'delivered') {
    return { kind: 'delivered' }
  }

  if (etaDisplay?.kind === 'unavailable') {
    return { kind: 'unavailable' }
  }

  if (eta !== null) {
    return {
      kind: 'date',
      value: eta,
    }
  }

  return { kind: 'unavailable' }
}

function toEtaMsOrNull(etaDisplay: ProcessSummaryVM['etaDisplay']): number | null {
  if (etaDisplay.kind === 'date' || etaDisplay.kind === 'arrived') {
    return toTimestampOrNull(etaDisplay.value)
  }

  return null
}

function toTrackingValidationIssueVm(
  issue:
    | NonNullable<NonNullable<ProcessListItemSource['tracking_validation']>['top_issue']>
    | null
    | undefined,
): TrackingValidationIssueVM | null {
  if (issue === null || issue === undefined) {
    return null
  }

  return {
    code: issue.code,
    severity: issue.severity,
    reasonKey: issue.reason_key,
    affectedArea: issue.affected_area,
    affectedLocation: issue.affected_location ?? null,
    affectedBlockLabelKey: issue.affected_block_label_key ?? null,
  }
}

function toProcessTrackingValidationVm(
  trackingValidation: ProcessListItemSource['tracking_validation'],
): ProcessTrackingValidationVM {
  return {
    hasIssues: trackingValidation?.has_issues === true,
    highestSeverity: trackingValidation?.highest_severity ?? null,
    affectedContainerCount: trackingValidation?.affected_container_count ?? 0,
    topIssue: toTrackingValidationIssueVm(trackingValidation?.top_issue),
  }
}

export function toProcessSummaryVMs(
  data: readonly ProcessListItemSource[],
): readonly ProcessSummaryVM[] {
  return data.map((process) => {
    const rawStatus = process.process_status ?? null
    const eta = process.eta ?? null
    const etaDisplay = toEtaDisplay(process.eta_display, eta)
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
      etaDisplay,
      etaMsOrNull: toEtaMsOrNull(etaDisplay),
      carrier: toOptionalNonBlankString(process.carrier),
      activeIncidentCount: process.operational_incidents?.summary.active_incidents ?? 0,
      affectedContainerCount: process.operational_incidents?.summary.affected_containers ?? 0,
      recognizedIncidentCount: process.operational_incidents?.summary.recognized_incidents ?? 0,
      dominantIncident:
        process.operational_incidents?.dominant === null ||
        process.operational_incidents?.dominant === undefined
          ? null
          : {
              type: process.operational_incidents.dominant.type,
              severity: process.operational_incidents.dominant.severity,
              factMessageKey: process.operational_incidents.dominant.fact.message_key,
              factMessageParams: process.operational_incidents.dominant.fact.message_params,
              triggeredAt: process.operational_incidents.dominant.triggered_at,
            },
      attentionSeverity:
        process.attention_severity ?? process.operational_incidents?.dominant?.severity ?? null,
      trackingValidation: toProcessTrackingValidationVm(process.tracking_validation),
      redestinationNumber: process.redestination_number ?? null,
      lastEventAt: process.last_event_at ?? null,
      syncStatus: toProcessSyncStatus(process.last_sync_status),
      lastSyncAt: process.last_sync_at ?? null,
    }
  })
}
