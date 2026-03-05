import type { ProcessOperationalSummary } from '~/modules/process/application/operational-projection/processOperationalSummary'
import type {
  ProcessContainerRecord,
  ProcessWithContainers,
} from '~/modules/process/application/process.readmodels'
import type {
  InsertProcessRecord,
  UpdateProcessRecord,
} from '~/modules/process/application/process.records'
import type { ProcessEntity } from '~/modules/process/domain/process.entity'
import type { CreateProcessInput } from '~/modules/process/interface/http/process.schemas'
import {
  createTrackingOperationalSummaryFallback,
  type TrackingOperationalSummary,
} from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import type { ContainerSyncDTO } from '~/modules/tracking/application/usecases/get-containers-sync-metadata.usecase'

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

type TrackingAlertRecord = {
  readonly id: string
  readonly category: string
  readonly type: string
  readonly severity: string
  readonly message: string
  readonly detected_at: string
  readonly triggered_at: string
  readonly retroactive: boolean
  readonly provider: string | null
  readonly acked_at: string | null
  readonly dismissed_at: string | null
}

type ContainerWithTrackingResponse = {
  id: string
  container_number: string
  carrier_code: string | null
  status: string
  observations: ReturnType<typeof toObservationResponse>[]
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
) {
  return {
    ...processToResponseFields(pwc.process),
    containers: pwc.containers.map(toContainerResponse),
    process_status: summary.process_status,
    eta: summary.eta,
    alerts_count: summary.alerts_count,
    highest_alert_severity: summary.highest_alert_severity,
    has_transshipment: summary.has_transshipment,
    last_event_at: summary.last_event_at,
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

function toTrackingAlertResponse(a: TrackingAlertRecord) {
  return {
    id: a.id,
    category: a.category,
    type: a.type,
    severity: a.severity,
    message: a.message,
    detected_at: a.detected_at,
    triggered_at: a.triggered_at,
    retroactive: a.retroactive,
    provider: a.provider,
    acked_at: a.acked_at,
    dismissed_at: a.dismissed_at,
  }
}

function toContainerSyncResponse(sync: ContainerSyncDTO) {
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
  },
) {
  return {
    ...toContainerResponse(c),
    status: summary.status,
    observations: summary.observations.map(toObservationResponse),
  }
}

export function toContainerWithTrackingFallback(c: ProcessContainerRecord) {
  return {
    ...toContainerResponse(c),
    status: 'UNKNOWN',
    observations: [],
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
  containersSync: readonly ContainerSyncDTO[],
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

  return {
    ...processToResponseFields(pwc.process),
    containers,
    containersSync: containersSync.map(toContainerSyncResponse),
    alerts: alerts.map(toTrackingAlertResponse),
    process_operational: toProcessOperationalResponse(summariesForProcess),
  }
}
