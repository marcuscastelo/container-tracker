import { deriveProcessStatusFromContainers } from '~/modules/process/application/operational-projection/deriveProcessStatus'
import { toOperationalStatus } from '~/modules/process/application/operational-projection/operationalSemantics'
import type { ProcessOperationalSummary } from '~/modules/process/application/operational-projection/processOperationalSummary'
import type {
  ProcessContainerRecord,
  ProcessWithContainers,
} from '~/modules/process/application/process.readmodels'
import type {
  InsertProcessRecord,
  UpdateProcessRecord,
} from '~/modules/process/application/process.records'
import type { ProcessSyncStateReadModel } from '~/modules/process/application/usecases/list-process-sync-states.usecase'
import type { ProcessSyncSummaryReadModel } from '~/modules/process/application/usecases/list-processes-with-operational-summary.usecase'
import type { RefreshProcessResult } from '~/modules/process/application/usecases/refresh-process.usecase'
import type { ProcessEntity } from '~/modules/process/domain/process.entity'
import type { CreateProcessInput } from '~/modules/process/interface/http/process.schemas'
import {
  type TrackingAlertDisplayReadModel,
  type TrackingAlertDisplaySource,
  toTrackingAlertDisplayReadModels,
} from '~/modules/tracking/application/projection/tracking.alert-display.readmodel'
import {
  createTrackingOperationalSummaryFallback,
  type TrackingOperationalSummary,
} from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import type {
  TrackingSeriesHistory,
  TrackingTimelineItem,
} from '~/modules/tracking/application/projection/tracking.timeline.readmodel'
import type { ContainerSyncRecord } from '~/modules/tracking/application/usecases/get-containers-sync-metadata.usecase'

// ---------------------------------------------------------------------------
// Request DTO → Command / Record
// ---------------------------------------------------------------------------

export function toInsertProcessRecord(dto: CreateProcessInput): InsertProcessRecord {
  return {
    reference: dto.reference ?? null,
    origin: dto.origin?.display_name,
    destination: dto.destination?.display_name,
    carrier: dto.carrier,
    bill_of_lading: dto.bill_of_lading ?? null,
    booking_number: dto.booking_number ?? null,
    importer_name: dto.importer_name ?? null,
    exporter_name: dto.exporter_name ?? null,
    reference_importer: dto.reference_importer ?? null,
    product: dto.product ?? undefined,
    redestination_number: dto.redestination_number ?? undefined,
    source: 'manual',
  }
}

export function toUpdateProcessRecord(dto: Partial<CreateProcessInput>): UpdateProcessRecord {
  return {
    ...(dto.reference !== undefined ? { reference: dto.reference ?? undefined } : {}),
    ...(dto.origin !== undefined ? { origin: dto.origin?.display_name } : {}),
    ...(dto.destination !== undefined ? { destination: dto.destination?.display_name } : {}),
    ...(dto.carrier !== undefined ? { carrier: dto.carrier } : {}),
    ...(dto.bill_of_lading !== undefined
      ? { bill_of_lading: dto.bill_of_lading ?? undefined }
      : {}),
    ...(dto.booking_number !== undefined
      ? { booking_number: dto.booking_number ?? undefined }
      : {}),
    ...(dto.importer_name !== undefined ? { importer_name: dto.importer_name ?? undefined } : {}),
    ...(dto.exporter_name !== undefined ? { exporter_name: dto.exporter_name ?? undefined } : {}),
    ...(dto.reference_importer !== undefined
      ? { reference_importer: dto.reference_importer ?? undefined }
      : {}),
    ...(dto.product !== undefined ? { product: dto.product ?? null } : {}),
    ...(dto.redestination_number !== undefined
      ? { redestination_number: dto.redestination_number ?? null }
      : {}),
  }
}

export function toContainerInputs(
  dto: Pick<CreateProcessInput, 'containers'>,
): readonly { container_number: string; carrier_code: string | null }[] {
  return dto.containers.map((c) => ({
    container_number: c.container_number,
    carrier_code: c.carrier_code ?? null,
  }))
}

// ---------------------------------------------------------------------------
// Result / ReadModel → Response DTO
// ---------------------------------------------------------------------------

type TrackingObservationRecord = {
  readonly id: string
  readonly fingerprint: string
  readonly type: string
  readonly carrier_label?: string | null
  readonly event_time: string | null
  readonly event_time_type: 'ACTUAL' | 'EXPECTED'
  readonly location_code: string | null
  readonly location_display: string | null
  readonly vessel_name: string | null
  readonly voyage: string | null
  readonly is_empty: boolean | null
  readonly confidence: string
  readonly provider: string
  readonly retroactive?: boolean
  readonly created_at: string
}

type TrackingAlertRecord = TrackingAlertDisplaySource

type ContainerWithTrackingResponse = {
  id: string
  container_number: string
  carrier_code: string | null
  status: string
  observations: ReturnType<typeof toObservationResponse>[]
  timeline: ReturnType<typeof toTimelineItemResponse>[]
}

function toContainerResponse(c: ProcessContainerRecord) {
  return {
    id: String(c.id),
    container_number: String(c.containerNumber),
    carrier_code: c.carrierCode == null ? null : String(c.carrierCode),
  }
}

function processToResponseFields(p: ProcessEntity) {
  return {
    id: p.id,
    reference: p.reference ?? null,
    origin: p.origin ? { display_name: p.origin } : null,
    destination: p.destination ? { display_name: p.destination } : null,
    carrier: p.carrier ?? null,
    bill_of_lading: p.billOfLading ?? null,
    booking_number: p.bookingNumber ?? null,
    importer_name: p.importerName ?? null,
    exporter_name: p.exporterName ?? null,
    reference_importer: p.referenceImporter ?? null,
    product: p.product ?? null,
    redestination_number: p.redestinationNumber ?? null,
    source: p.source,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  }
}

export function toProcessResponse(pwc: ProcessWithContainers) {
  return {
    ...processToResponseFields(pwc.process),
    containers: pwc.containers.map(toContainerResponse),
  }
}

export function toProcessResponseWithSummary(
  pwc: ProcessWithContainers,
  summary: ProcessOperationalSummary,
  sync: ProcessSyncSummaryReadModel,
) {
  return {
    ...processToResponseFields(pwc.process),
    containers: pwc.containers.map(toContainerResponse),
    process_status: summary.process_status,
    eta: summary.eta,
    alerts_count: summary.alerts_count,
    highest_alert_severity: summary.highest_alert_severity,
    dominant_alert_created_at: summary.dominant_alert_created_at,
    has_transshipment: summary.has_transshipment,
    last_event_at: summary.last_event_at,
    last_sync_status: sync.lastSyncStatus,
    last_sync_at: sync.lastSyncAt,
  }
}

export function toProcessSyncStateResponse(sync: ProcessSyncStateReadModel) {
  return {
    process_id: sync.processId,
    sync_status: sync.syncStatus,
    started_at: sync.startedAt,
    finished_at: sync.finishedAt,
    container_count: sync.containerCount,
    completed_containers: sync.completedContainers,
    failed_containers: sync.failedContainers,
    visibility: sync.visibility,
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

// ---------------------------------------------------------------------------
// Tracking data → Response DTO
// ---------------------------------------------------------------------------

function toObservationResponse(obs: TrackingObservationRecord) {
  return {
    id: obs.id,
    fingerprint: obs.fingerprint,
    type: obs.type,
    carrier_label: obs.carrier_label ?? null,
    event_time: obs.event_time,
    event_time_type: obs.event_time_type,
    location_code: obs.location_code,
    location_display: obs.location_display,
    vessel_name: obs.vessel_name,
    voyage: obs.voyage,
    is_empty: obs.is_empty,
    confidence: obs.confidence,
    provider: obs.provider,
    retroactive: obs.retroactive,
    created_at: obs.created_at,
  }
}

function toTrackingAlertResponse(a: TrackingAlertDisplayReadModel) {
  const messageContract = (() => {
    switch (a.message_key) {
      case 'alerts.transshipmentDetected':
        return {
          message_key: a.message_key,
          message_params: a.message_params,
        }
      case 'alerts.customsHoldDetected':
        return {
          message_key: a.message_key,
          message_params: a.message_params,
        }
      case 'alerts.noMovementDetected':
        return {
          message_key: a.message_key,
          message_params: a.message_params,
        }
      case 'alerts.etaMissing':
        return {
          message_key: a.message_key,
          message_params: a.message_params,
        }
      case 'alerts.etaPassed':
        return {
          message_key: a.message_key,
          message_params: a.message_params,
        }
      case 'alerts.portChange':
        return {
          message_key: a.message_key,
          message_params: a.message_params,
        }
      case 'alerts.dataInconsistent':
        return {
          message_key: a.message_key,
          message_params: a.message_params,
        }
    }
  })()

  return {
    id: a.id,
    container_number: a.container_number,
    category: a.category,
    type: a.type,
    severity: a.severity,
    ...messageContract,
    detected_at: a.detected_at,
    triggered_at: a.triggered_at,
    retroactive: a.retroactive,
    provider: a.provider,
    acked_at: a.acked_at,
  }
}

function toSeriesHistoryResponse(seriesHistory: TrackingSeriesHistory) {
  return {
    has_actual_conflict: seriesHistory.hasActualConflict,
    classified: seriesHistory.classified.map((item) => ({
      id: item.id,
      type: item.type,
      event_time: item.event_time,
      event_time_type: item.event_time_type,
      created_at: item.created_at,
      series_label: item.seriesLabel,
    })),
  }
}

function toTimelineItemResponse(item: TrackingTimelineItem) {
  return {
    id: item.id,
    type: item.type,
    carrier_label: item.carrierLabel ?? null,
    location: item.location ?? null,
    event_time_iso: item.eventTimeIso,
    event_time_type: item.eventTimeType,
    derived_state: item.derivedState,
    vessel_name: item.vesselName ?? null,
    voyage: item.voyage ?? null,
    series_history: item.seriesHistory ? toSeriesHistoryResponse(item.seriesHistory) : null,
  }
}

function compareAlertsByTriggeredAtDesc(
  left: TrackingAlertRecord,
  right: TrackingAlertRecord,
): number {
  const triggeredAtCompare = right.triggered_at.localeCompare(left.triggered_at)
  if (triggeredAtCompare !== 0) return triggeredAtCompare
  return right.id.localeCompare(left.id)
}

function toContainerSyncResponse(sync: ContainerSyncRecord) {
  return {
    containerNumber: sync.containerNumber,
    carrier: sync.carrier,
    lastSuccessAt: sync.lastSuccessAt,
    lastAttemptAt: sync.lastAttemptAt,
    isSyncing: sync.isSyncing,
    lastErrorCode: sync.lastErrorCode,
    lastErrorAt: sync.lastErrorAt,
  }
}

/**
 * Maps a container entity + its tracking summary to the detail response shape.
 * If tracking fetch fails, returns a fallback with status 'UNKNOWN' and empty observations.
 */
export function toContainerWithTrackingResponse(
  c: ProcessContainerRecord,
  summary: {
    status: string
    observations: readonly TrackingObservationRecord[]
    timeline: readonly TrackingTimelineItem[]
  },
) {
  return {
    ...toContainerResponse(c),
    status: summary.status,
    observations: summary.observations.map(toObservationResponse),
    timeline: summary.timeline.map(toTimelineItemResponse),
  }
}

export function toContainerWithTrackingFallback(c: ProcessContainerRecord) {
  return {
    ...toContainerResponse(c),
    status: 'UNKNOWN',
    observations: [],
    timeline: [],
  }
}

function toOperationalEtaResponse(eta: TrackingOperationalSummary['eta']) {
  if (!eta) return null
  return {
    event_time: eta.eventTimeIso,
    event_time_type: eta.eventTimeType,
    state: eta.state,
    type: eta.type,
    location_code: eta.locationCode,
    location_display: eta.locationDisplay,
  }
}

function toOperationalTransshipmentResponse(
  transshipment: TrackingOperationalSummary['transshipment'],
) {
  return {
    has_transshipment: transshipment.hasTransshipment,
    count: transshipment.count,
    ports: transshipment.ports.map((port) => ({
      code: port.code,
      display: port.display,
    })),
  }
}

function toContainerOperationalResponse(summary: TrackingOperationalSummary) {
  return {
    status: summary.status,
    eta: toOperationalEtaResponse(summary.eta),
    transshipment: toOperationalTransshipmentResponse(summary.transshipment),
    data_issue: summary.dataIssue,
  }
}

function toProcessOperationalResponse(summaries: readonly TrackingOperationalSummary[]) {
  const total = summaries.length
  const processStatus = deriveProcessStatusFromContainers(
    summaries.map((summary) => toOperationalStatus(summary.status)),
  )
  const etaCandidates = summaries
    .map((summary) => summary.eta)
    .filter((eta): eta is NonNullable<TrackingOperationalSummary['eta']> => eta !== null)
  const withEta = etaCandidates.length

  let etaMax: NonNullable<TrackingOperationalSummary['eta']> | null = null
  for (const eta of etaCandidates) {
    if (!etaMax || eta.eventTimeIso > etaMax.eventTimeIso) {
      etaMax = eta
    }
  }

  return {
    derived_status: processStatus,
    eta_max: toOperationalEtaResponse(etaMax),
    coverage: {
      total,
      with_eta: withEta,
    },
  }
}

export function toProcessDetailResponse(
  pwc: ProcessWithContainers,
  containersWithTracking: readonly ContainerWithTrackingResponse[],
  alerts: readonly TrackingAlertRecord[],
  operationalByContainerId: ReadonlyMap<string, TrackingOperationalSummary>,
  containersSync: readonly ContainerSyncRecord[],
) {
  const fallbackByContainerId = new Map<string, TrackingOperationalSummary>()

  const containers = containersWithTracking.map((container) => {
    const summary =
      operationalByContainerId.get(container.id) ??
      fallbackByContainerId.get(container.id) ??
      createTrackingOperationalSummaryFallback(true)

    if (!fallbackByContainerId.has(container.id) && !operationalByContainerId.has(container.id)) {
      fallbackByContainerId.set(container.id, summary)
    }

    return {
      ...container,
      operational: toContainerOperationalResponse(summary),
    }
  })

  const summariesForProcess = containersWithTracking.map((container) => {
    const fromBatch = operationalByContainerId.get(container.id)
    if (fromBatch) return fromBatch
    const fallback = fallbackByContainerId.get(container.id)
    if (fallback) return fallback
    const createdFallback = createTrackingOperationalSummaryFallback(true)
    fallbackByContainerId.set(container.id, createdFallback)
    return createdFallback
  })

  const containerNumberByContainerId = new Map<string, string>()
  for (const container of containersWithTracking) {
    containerNumberByContainerId.set(container.id, container.container_number)
  }

  const alertDisplayReadModel = toTrackingAlertDisplayReadModels(
    alerts,
    (containerId) => containerNumberByContainerId.get(containerId) ?? null,
  )

  return {
    ...processToResponseFields(pwc.process),
    containers,
    containersSync: containersSync.map(toContainerSyncResponse),
    alerts: [...alertDisplayReadModel]
      .sort(compareAlertsByTriggeredAtDesc)
      .map(toTrackingAlertResponse),
    process_operational: toProcessOperationalResponse(summariesForProcess),
  }
}
