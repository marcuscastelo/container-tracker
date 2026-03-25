import type {
  ProcessContainerRecord,
  ProcessWithContainers,
} from '~/modules/process/application/process.readmodels'
import type {
  InsertProcessRecord,
  UpdateProcessRecord,
} from '~/modules/process/application/process.records'
import type { ProcessSyncSummaryReadModel } from '~/modules/process/application/usecases/list-processes-with-operational-summary.usecase'
import type { ProcessEntity } from '~/modules/process/domain/process.entity'
import {
  deriveProcessStatusDispersion,
  deriveProcessStatusFromContainers,
} from '~/modules/process/features/operational-projection/application/deriveProcessStatus'
import { toOperationalStatus } from '~/modules/process/features/operational-projection/application/operationalSemantics'
import type { ProcessOperationalSummary } from '~/modules/process/features/operational-projection/application/processOperationalSummary'
import type { CreateProcessInput } from '~/modules/process/interface/http/process.schemas'
import {
  createTrackingOperationalSummaryFallback,
  type TrackingOperationalSummary,
} from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import type { ContainerSyncRecord } from '~/modules/tracking/application/usecases/get-containers-sync-metadata.usecase'
import {
  type TrackingAlertDisplayReadModel,
  type TrackingAlertDisplaySource,
  toTrackingAlertDisplayReadModels,
} from '~/modules/tracking/features/alerts/application/projection/tracking.alert-display.readmodel'
import { toTrackingAlertMessageContract } from '~/modules/tracking/features/alerts/application/projection/tracking.alert-message-contract.mapper'
import type {
  TrackingSeriesHistory,
  TrackingTimelineItem,
} from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { compareTemporal } from '~/shared/time/compare-temporal'
import { toTemporalValueDto } from '~/shared/time/dto'
import { parseTemporalValue } from '~/shared/time/parsing'
import type { TemporalValue } from '~/shared/time/temporal-value'

// ---------------------------------------------------------------------------
// Request DTO → Command / Record
// ---------------------------------------------------------------------------

export function toInsertProcessRecord(dto: CreateProcessInput): InsertProcessRecord {
  return {
    reference: dto.reference ?? null,
    origin: dto.origin?.display_name ?? null,
    destination: dto.destination?.display_name ?? null,
    carrier: dto.carrier,
    bill_of_lading: dto.bill_of_lading ?? null,
    booking_number: dto.booking_number ?? null,
    importer_name: dto.importer_name ?? null,
    exporter_name: dto.exporter_name ?? null,
    reference_importer: dto.reference_importer ?? null,
    ...(dto.product !== undefined ? { product: dto.product ?? null } : {}),
    ...(dto.redestination_number !== undefined
      ? { redestination_number: dto.redestination_number ?? null }
      : {}),
    source: 'manual',
  }
}

export function toUpdateProcessRecord(dto: Partial<CreateProcessInput>): UpdateProcessRecord {
  return {
    ...(dto.reference !== undefined ? { reference: dto.reference ?? null } : {}),
    ...(dto.origin !== undefined ? { origin: dto.origin?.display_name ?? null } : {}),
    ...(dto.destination !== undefined
      ? { destination: dto.destination?.display_name ?? null }
      : {}),
    ...(dto.carrier !== undefined ? { carrier: dto.carrier } : {}),
    ...(dto.bill_of_lading !== undefined ? { bill_of_lading: dto.bill_of_lading ?? null } : {}),
    ...(dto.booking_number !== undefined ? { booking_number: dto.booking_number ?? null } : {}),
    ...(dto.importer_name !== undefined ? { importer_name: dto.importer_name ?? null } : {}),
    ...(dto.exporter_name !== undefined ? { exporter_name: dto.exporter_name ?? null } : {}),
    ...(dto.reference_importer !== undefined
      ? { reference_importer: dto.reference_importer ?? null }
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
  readonly event_time: TemporalValue | null
  readonly event_time_type: 'ACTUAL' | 'EXPECTED'
  readonly location_code: string | null
  readonly location_display: string | null
  readonly vessel_name: string | null
  readonly voyage: string | null
  readonly is_empty: boolean | null
  readonly confidence: string
  readonly provider: string
  readonly created_from_snapshot_id?: string
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

function resolveTrackingAlertLifecycleStateFromReadModel(
  alert: Pick<TrackingAlertDisplayReadModel, 'lifecycle_state' | 'acked_at' | 'resolved_at'>,
): 'ACTIVE' | 'ACKED' | 'AUTO_RESOLVED' {
  if (alert.lifecycle_state === 'ACTIVE') return 'ACTIVE'
  if (alert.lifecycle_state === 'ACKED') return 'ACKED'
  if (alert.lifecycle_state === 'AUTO_RESOLVED') return 'AUTO_RESOLVED'
  if (alert.acked_at !== null) return 'ACKED'
  if (alert.resolved_at !== null && alert.resolved_at !== undefined) return 'AUTO_RESOLVED'
  return 'ACTIVE'
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
    created_at: p.createdAt.toIsoString(),
    updated_at: p.updatedAt.toIsoString(),
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
    highest_container_status: summary.highest_container_status,
    status_counts: summary.status_counts,
    status_microbadge: summary.status_microbadge,
    has_status_dispersion: summary.has_status_dispersion,
    lifecycle_bucket: summary.lifecycle_bucket,
    final_delivery_complete: summary.final_delivery_complete,
    full_logistics_complete: summary.full_logistics_complete,
    eta: summary.eta,
    eta_coverage: {
      total: summary.eta_coverage.total,
      eligible_total: summary.eta_coverage.eligible_total,
      with_eta: summary.eta_coverage.with_eta,
    },
    alerts_count: summary.alerts_count,
    highest_alert_severity: summary.highest_alert_severity,
    dominant_alert_created_at: summary.dominant_alert_created_at,
    has_transshipment: summary.has_transshipment,
    last_event_at: summary.last_event_at,
    last_sync_status: sync.lastSyncStatus,
    last_sync_at: sync.lastSyncAt,
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
    event_time: obs.event_time === null ? null : toTemporalValueDto(obs.event_time),
    event_time_type: obs.event_time_type,
    location_code: obs.location_code,
    location_display: obs.location_display,
    vessel_name: obs.vessel_name,
    voyage: obs.voyage,
    is_empty: obs.is_empty,
    confidence: obs.confidence,
    provider: obs.provider,
    created_from_snapshot_id: obs.created_from_snapshot_id,
    retroactive: obs.retroactive,
    created_at: obs.created_at,
  }
}

function toTrackingAlertResponse(a: TrackingAlertDisplayReadModel) {
  const lifecycleState = resolveTrackingAlertLifecycleStateFromReadModel(a)
  return {
    id: a.id,
    container_number: a.container_number,
    category: a.category,
    type: a.type,
    severity: a.severity,
    ...toTrackingAlertMessageContract(a),
    detected_at: a.detected_at,
    triggered_at: a.triggered_at,
    retroactive: a.retroactive,
    provider: a.provider,
    lifecycle_state: lifecycleState,
    acked_at: a.acked_at,
    resolved_at: a.resolved_at ?? null,
    resolved_reason: a.resolved_reason ?? null,
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
    event_time: item.eventTime,
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
    event_time: eta.eventTime,
    event_time_type: eta.eventTimeType,
    state: eta.state,
    type: eta.type,
    location_code: eta.locationCode,
    location_display: eta.locationDisplay,
  }
}

const PROCESS_ETA_COMPARE_OPTIONS = {
  timezone: 'UTC',
  strategy: 'start-of-day',
} as const

function isEtaAfter(
  candidate: NonNullable<TrackingOperationalSummary['eta']>,
  current: NonNullable<TrackingOperationalSummary['eta']>,
): boolean {
  const candidateTemporal = parseTemporalValue(candidate.eventTime)
  const currentTemporal = parseTemporalValue(current.eventTime)
  if (candidateTemporal && currentTemporal) {
    return compareTemporal(candidateTemporal, currentTemporal, PROCESS_ETA_COMPARE_OPTIONS) > 0
  }

  return JSON.stringify(candidate.eventTime) > JSON.stringify(current.eventTime)
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
    // normalize lifecycle bucket first so eta applicability uses the same fallback
    // logic everywhere (legacy read models may lack lifecycleBucket)
    lifecycle_bucket: (() => {
      const bucket = summary.lifecycleBucket ?? 'pre_arrival'
      return bucket
    })(),
    eta_applicable: (() => {
      const bucket = summary.lifecycleBucket ?? 'pre_arrival'
      return summary.etaApplicable ?? bucket === 'pre_arrival'
    })(),
    transshipment: toOperationalTransshipmentResponse(summary.transshipment),
    data_issue: summary.dataIssue,
  }
}

function deriveProcessLifecycleBucket(
  lifecycleBuckets: readonly ('pre_arrival' | 'post_arrival_pre_delivery' | 'final_delivery')[],
): 'pre_arrival' | 'post_arrival_pre_delivery' | 'final_delivery' {
  if (lifecycleBuckets.length === 0) return 'pre_arrival'
  if (lifecycleBuckets.every((bucket) => bucket === 'final_delivery')) return 'final_delivery'
  if (lifecycleBuckets.some((bucket) => bucket === 'pre_arrival')) return 'pre_arrival'
  return 'post_arrival_pre_delivery'
}

function toProcessOperationalResponse(summaries: readonly TrackingOperationalSummary[]) {
  const total = summaries.length
  const statuses = summaries.map((summary) => toOperationalStatus(summary.status))
  const processStatus = deriveProcessStatusFromContainers(statuses)
  const processStatusDispersion = deriveProcessStatusDispersion({
    statuses,
    primaryStatus: processStatus,
  })
  const lifecycleBuckets = summaries.map((summary) => summary.lifecycleBucket ?? 'pre_arrival')
  const processLifecycleBucket = deriveProcessLifecycleBucket(lifecycleBuckets)

  const finalDeliveryComplete =
    statuses.length > 0 &&
    statuses.every((status) => status === 'DELIVERED' || status === 'EMPTY_RETURNED')
  const fullLogisticsComplete =
    statuses.length > 0 && statuses.every((status) => status === 'EMPTY_RETURNED')

  const etaEligibleSummaries = summaries.filter(
    (summary) => (summary.etaApplicable ?? summary.lifecycleBucket === 'pre_arrival') === true,
  )
  const etaCandidates = etaEligibleSummaries
    .map((summary) => summary.eta)
    .filter((eta): eta is NonNullable<TrackingOperationalSummary['eta']> => eta !== null)
  const withEta = etaEligibleSummaries
    .map((summary) => summary.eta)
    .filter((eta): eta is NonNullable<TrackingOperationalSummary['eta']> => eta !== null).length

  let etaMax: NonNullable<TrackingOperationalSummary['eta']> | null = null
  for (const eta of etaCandidates) {
    if (!etaMax || isEtaAfter(eta, etaMax)) {
      etaMax = eta
    }
  }

  return {
    derived_status: processStatus,
    highest_container_status: processStatusDispersion.highest_container_status,
    status_counts: processStatusDispersion.status_counts,
    status_microbadge: processStatusDispersion.status_microbadge,
    has_status_dispersion: processStatusDispersion.has_status_dispersion,
    lifecycle_bucket: processLifecycleBucket,
    final_delivery_complete: finalDeliveryComplete,
    full_logistics_complete: fullLogisticsComplete,
    eta_max: toOperationalEtaResponse(etaMax),
    coverage: {
      total,
      eligible_total: etaEligibleSummaries.length,
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
