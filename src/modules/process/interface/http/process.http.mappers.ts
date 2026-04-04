import { createHash } from 'node:crypto'
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
import type { TrackingOperationalSummary } from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import type {
  ShipmentAlertIncidentReadModel,
  ShipmentAlertIncidentRecordReadModel,
  ShipmentAlertIncidentsReadModel,
} from '~/modules/tracking/application/projection/tracking.shipment-alert-incidents.readmodel'
import type { ContainerSyncRecord } from '~/modules/tracking/application/usecases/get-containers-sync-metadata.usecase'
import {
  type TrackingAlertDisplayReadModel,
  toTrackingAlertDisplayReadModels,
} from '~/modules/tracking/features/alerts/application/projection/tracking.alert-display.readmodel'
import { toTrackingAlertMessageContract } from '~/modules/tracking/features/alerts/application/projection/tracking.alert-message-contract.mapper'
import type { TrackingAlert } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type {
  TrackingSeriesHistory,
  TrackingTimelineItem,
} from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import {
  aggregateTrackingValidationProjection,
  createEmptyTrackingValidationProcessProjectionSummary,
  pickTopTrackingValidationIssueForProcess,
  type TrackingValidationContainerSummary,
  type TrackingValidationProcessSummary,
} from '~/modules/tracking/features/validation/application/projection/trackingValidation.projection'
import type { TrackingValidationDisplayIssue } from '~/modules/tracking/features/validation/domain/model/trackingValidationDisplayIssue'
import { compareTemporal } from '~/shared/time/compare-temporal'
import { type TemporalValueDto, toTemporalValueDto } from '~/shared/time/dto'
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
  readonly raw_event_time?: string | null
  readonly event_time_source?: string | null
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

function toTrackingValidationSeverityResponse(
  severity: TrackingValidationContainerSummary['highestSeverity'],
): 'info' | 'warning' | 'danger' | null {
  if (severity === 'CRITICAL') return 'danger'
  if (severity === 'ADVISORY') return 'warning'
  return null
}

function toTrackingValidationIssueSeverityResponse(
  severity: TrackingValidationDisplayIssue['severity'],
): 'warning' | 'danger' {
  if (severity === 'CRITICAL') return 'danger'
  return 'warning'
}

function toTrackingValidationAttentionSeverity(
  severity: TrackingValidationProcessSummary['highestSeverity'],
): 'danger' | null {
  if (severity === 'CRITICAL') return 'danger'
  return null
}

function toProcessAttentionSeverity(command: {
  readonly highestAlertSeverity: 'info' | 'warning' | 'danger' | null
  readonly trackingValidation: TrackingValidationProcessSummary
}): 'info' | 'warning' | 'danger' | null {
  const validationSeverity = toTrackingValidationAttentionSeverity(
    command.trackingValidation.highestSeverity,
  )

  if (command.highestAlertSeverity === 'danger' || validationSeverity === 'danger') {
    return 'danger'
  }

  return command.highestAlertSeverity
}

type TrackingAlertRecord = TrackingAlert
type AlertTriggeredSortItem = {
  readonly id: string
  readonly triggered_at: string
}

type ContainerWithTrackingResponse = {
  id: string
  container_number: string
  carrier_code: string | null
  status: string
  timeline: ReturnType<typeof toTimelineItemResponse>[]
}

type EtaDisplayResponse =
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

function createEmptyProcessTrackingValidationResponse() {
  return {
    has_issues: false,
    highest_severity: null,
    affected_container_count: 0,
    top_issue: null,
  }
}

export function toProcessResponse(pwc: ProcessWithContainers) {
  return {
    ...processToResponseFields(pwc.process),
    containers: pwc.containers.map(toContainerResponse),
    attention_severity: null,
    tracking_validation: createEmptyProcessTrackingValidationResponse(),
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
    eta_display: summary.eta_display,
    eta_coverage: {
      total: summary.eta_coverage.total,
      eligible_total: summary.eta_coverage.eligible_total,
      with_eta: summary.eta_coverage.with_eta,
    },
    alerts_count: summary.alerts_count,
    highest_alert_severity: summary.highest_alert_severity,
    attention_severity: summary.attention_severity,
    dominant_alert_created_at: summary.dominant_alert_created_at,
    tracking_validation: toProcessTrackingValidationResponse(
      summary.tracking_validation,
      summary.tracking_validation_top_issue,
    ),
    has_transshipment: summary.has_transshipment,
    last_event_at: summary.last_event_at,
    last_sync_status: sync.lastSyncStatus,
    last_sync_at: sync.lastSyncAt,
  }
}

// ---------------------------------------------------------------------------
// Tracking data → Response DTO
// ---------------------------------------------------------------------------

export function toObservationResponse(obs: TrackingObservationRecord) {
  return {
    id: obs.id,
    fingerprint: obs.fingerprint,
    type: obs.type,
    carrier_label: obs.carrier_label ?? null,
    event_time: obs.event_time === null ? null : toTemporalValueDto(obs.event_time),
    event_time_type: obs.event_time_type,
    raw_event_time: obs.raw_event_time ?? null,
    event_time_source: obs.event_time_source ?? null,
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

function toShipmentAlertIncidentRecordResponse(record: ShipmentAlertIncidentRecordReadModel) {
  return {
    alert_id: record.alertId,
    lifecycle_state: record.lifecycleState,
    detected_at: record.detectedAt,
    triggered_at: record.triggeredAt,
    acked_at: record.ackedAt,
    resolved_at: record.resolvedAt,
    resolved_reason: record.resolvedReason,
    threshold_days: record.thresholdDays,
    days_without_movement: record.daysWithoutMovement,
    last_event_date: record.lastEventDate,
  }
}

function toShipmentAlertIncidentResponse(incident: ShipmentAlertIncidentReadModel) {
  return {
    incident_key: incident.incidentKey,
    bucket: incident.bucket,
    category: incident.category,
    type: incident.type,
    severity: incident.severity,
    message_key: incident.messageKey,
    message_params: incident.messageParams,
    detected_at: incident.detectedAt,
    triggered_at: incident.triggeredAt,
    threshold_days: incident.thresholdDays,
    days_without_movement: incident.daysWithoutMovement,
    last_event_date: incident.lastEventDate,
    transshipment_order: incident.transshipmentOrder,
    port: incident.port,
    from_vessel: incident.fromVessel,
    to_vessel: incident.toVessel,
    affected_container_count: incident.affectedContainerCount,
    active_alert_ids: [...incident.activeAlertIds],
    acked_alert_ids: [...incident.ackedAlertIds],
    members: incident.members.map((member) => ({
      container_id: member.containerId,
      container_number: member.containerNumber,
      lifecycle_state: member.lifecycleState,
      detected_at: member.detectedAt,
      threshold_days: member.thresholdDays,
      days_without_movement: member.daysWithoutMovement,
      last_event_date: member.lastEventDate,
      transshipment_order: member.transshipmentOrder,
      port: member.port,
      from_vessel: member.fromVessel,
      to_vessel: member.toVessel,
      records: member.records.map(toShipmentAlertIncidentRecordResponse),
    })),
    monitoring_history: incident.monitoringHistory.map(toShipmentAlertIncidentRecordResponse),
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
    observation_id: item.observationId ?? null,
    type: item.type,
    carrier_label: item.carrierLabel ?? null,
    location: item.location ?? null,
    event_time: item.eventTime,
    event_time_type: item.eventTimeType,
    derived_state: item.derivedState,
    vessel_name: item.vesselName ?? null,
    voyage: item.voyage ?? null,
    has_series_history: item.hasSeriesHistory ?? false,
    series_history: item.seriesHistory ? toSeriesHistoryResponse(item.seriesHistory) : null,
  }
}

function compareAlertsByTriggeredAtDesc(
  left: AlertTriggeredSortItem,
  right: AlertTriggeredSortItem,
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
 * If tracking fetch fails, returns a fallback with status 'UNKNOWN' and empty timeline.
 */
export function toContainerWithTrackingResponse(
  c: ProcessContainerRecord,
  summary: {
    status: string
    timeline: readonly TrackingTimelineItem[]
  },
) {
  return {
    ...toContainerResponse(c),
    status: summary.status,
    timeline: summary.timeline.map(toTimelineItemResponse),
  }
}

export function toContainerWithTrackingFallback(c: ProcessContainerRecord) {
  return {
    ...toContainerResponse(c),
    status: 'UNKNOWN',
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

function toTrackingValidationDisplayIssueResponse(issue: TrackingValidationDisplayIssue) {
  return {
    code: issue.code,
    severity: toTrackingValidationIssueSeverityResponse(issue.severity),
    reason_key: issue.reasonKey,
    affected_area: issue.affectedArea,
    affected_location: issue.affectedLocation,
    affected_block_label_key: issue.affectedBlockLabelKey,
  }
}

function toOptionalTrackingValidationDisplayIssueResponse(
  issue: TrackingValidationDisplayIssue | null,
) {
  if (issue === null) {
    return null
  }

  return toTrackingValidationDisplayIssueResponse(issue)
}

function toContainerTrackingValidationResponse(summary: TrackingValidationContainerSummary) {
  return {
    has_issues: summary.hasIssues,
    highest_severity: toTrackingValidationSeverityResponse(summary.highestSeverity),
    finding_count: summary.findingCount,
    active_issues: summary.activeIssues.map((issue) =>
      toTrackingValidationDisplayIssueResponse(issue),
    ),
  }
}

function toProcessTrackingValidationResponse(
  summary?: TrackingValidationProcessSummary,
  topIssue: TrackingValidationDisplayIssue | null = null,
) {
  const currentSummary = summary ?? createEmptyTrackingValidationProcessProjectionSummary()

  return {
    has_issues: currentSummary.hasIssues,
    highest_severity: toTrackingValidationSeverityResponse(currentSummary.highestSeverity),
    affected_container_count: currentSummary.affectedContainerCount,
    top_issue: toOptionalTrackingValidationDisplayIssueResponse(topIssue),
  }
}

function toOperationalCurrentContextResponse(
  currentContext: TrackingOperationalSummary['currentContext'],
) {
  return {
    location_code: currentContext.locationCode,
    location_display: currentContext.locationDisplay,
    vessel_name: currentContext.vesselName,
    voyage: currentContext.voyage,
    vessel_visible: currentContext.vesselVisible,
  }
}

function toOperationalNextLocationResponse(
  nextLocation: TrackingOperationalSummary['nextLocation'],
) {
  if (!nextLocation) return null

  return {
    event_time: nextLocation.eventTime,
    event_time_type: nextLocation.eventTimeType,
    type: nextLocation.type,
    location_code: nextLocation.locationCode,
    location_display: nextLocation.locationDisplay,
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

function isDeliveredEtaStatus(status: string): boolean {
  return status === 'DELIVERED' || status === 'EMPTY_RETURNED'
}

function toContainerEtaDisplayResponse(summary: TrackingOperationalSummary): EtaDisplayResponse {
  const lifecycleBucket = summary.lifecycleBucket ?? 'pre_arrival'
  if (lifecycleBucket === 'final_delivery' && isDeliveredEtaStatus(summary.status)) {
    return { kind: 'delivered' }
  }

  if (summary.eta !== null) {
    if (summary.eta.state === 'ACTUAL') {
      return {
        kind: 'arrived',
        value: summary.eta.eventTime,
      }
    }

    return {
      kind: 'date',
      value: summary.eta.eventTime,
    }
  }

  return { kind: 'unavailable' }
}

function toProcessEtaDisplayResponse(command: {
  readonly etaMax: NonNullable<TrackingOperationalSummary['eta']> | null
  readonly finalDeliveryComplete: boolean
}): EtaDisplayResponse {
  if (command.finalDeliveryComplete) {
    return { kind: 'delivered' }
  }

  if (command.etaMax !== null) {
    if (command.etaMax.state === 'ACTUAL') {
      return {
        kind: 'arrived',
        value: command.etaMax.eventTime,
      }
    }

    return {
      kind: 'date',
      value: command.etaMax.eventTime,
    }
  }

  return { kind: 'unavailable' }
}

function toContainerOperationalResponse(summary: TrackingOperationalSummary) {
  return {
    status: summary.status,
    eta: toOperationalEtaResponse(summary.eta),
    eta_display: toContainerEtaDisplayResponse(summary),
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
    current_context: toOperationalCurrentContextResponse(summary.currentContext),
    next_location: toOperationalNextLocationResponse(summary.nextLocation),
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
    eta_display: toProcessEtaDisplayResponse({ etaMax, finalDeliveryComplete }),
    coverage: {
      total,
      eligible_total: etaEligibleSummaries.length,
      with_eta: withEta,
    },
  }
}

function toTrackingFreshnessToken(command: {
  readonly containers: ReadonlyArray<
    ContainerWithTrackingResponse & {
      readonly operational: ReturnType<typeof toContainerOperationalResponse>
      readonly tracking_validation: ReturnType<typeof toContainerTrackingValidationResponse>
    }
  >
  readonly alerts: readonly ReturnType<typeof toTrackingAlertResponse>[]
  readonly activeAlertIncidents: readonly ReturnType<typeof toShipmentAlertIncidentResponse>[]
  readonly processOperational: ReturnType<typeof toProcessOperationalResponse>
  readonly trackingValidation: ReturnType<typeof toProcessTrackingValidationResponse>
}): string {
  const stablePayload = {
    containers: command.containers.map((container) => ({
      id: container.id,
      status: container.status,
      operational: container.operational,
      tracking_validation: container.tracking_validation,
      timeline: container.timeline,
    })),
    alerts: command.alerts.map((alert) => ({
      id: alert.id,
      container_number: alert.container_number,
      severity: alert.severity,
      type: alert.type,
      triggered_at: alert.triggered_at,
      lifecycle_state: alert.lifecycle_state,
    })),
    active_alert_incidents: command.activeAlertIncidents.map((incident) => ({
      incident_key: incident.incident_key,
      type: incident.type,
      severity: incident.severity,
      active_alert_ids: incident.active_alert_ids,
      acked_alert_ids: incident.acked_alert_ids,
      triggered_at: incident.triggered_at,
    })),
    process_operational: command.processOperational,
    tracking_validation: command.trackingValidation,
  }

  return createHash('sha1').update(JSON.stringify(stablePayload)).digest('hex')
}

export function toProcessDetailResponse(
  pwc: ProcessWithContainers,
  containersWithTracking: readonly ContainerWithTrackingResponse[],
  alerts: readonly TrackingAlertRecord[],
  activeAlertIncidents: ShipmentAlertIncidentsReadModel,
  operationalByContainerId: ReadonlyMap<string, TrackingOperationalSummary>,
  trackingValidationByContainerId: ReadonlyMap<string, TrackingValidationContainerSummary>,
  containersSync: readonly ContainerSyncRecord[],
) {
  const containers = containersWithTracking.map((container) => {
    const summary = operationalByContainerId.get(container.id)
    if (summary === undefined) {
      throw new Error(
        `toProcessDetailResponse missing operational summary for container ${container.id}`,
      )
    }
    const trackingValidation = trackingValidationByContainerId.get(container.id)
    if (trackingValidation === undefined) {
      throw new Error(
        `toProcessDetailResponse missing tracking validation summary for container ${container.id}`,
      )
    }

    return {
      ...container,
      operational: toContainerOperationalResponse(summary),
      tracking_validation: toContainerTrackingValidationResponse(trackingValidation),
    }
  })

  const summariesForProcess = containersWithTracking.map((container) => {
    const summary = operationalByContainerId.get(container.id)
    if (summary === undefined) {
      throw new Error(
        `toProcessDetailResponse missing process operational summary for container ${container.id}`,
      )
    }
    return summary
  })
  const validationSummariesForProcess = containersWithTracking.map((container) => {
    const summary = trackingValidationByContainerId.get(container.id)
    if (summary === undefined) {
      throw new Error(
        `toProcessDetailResponse missing process tracking validation summary for container ${container.id}`,
      )
    }
    return summary
  })

  const containerNumberByContainerId = new Map<string, string>()
  for (const container of containersWithTracking) {
    containerNumberByContainerId.set(container.id, container.container_number)
  }

  const alertDisplayReadModel = toTrackingAlertDisplayReadModels(
    alerts,
    (containerId) => containerNumberByContainerId.get(containerId) ?? null,
  )
  const alertsResponse = [...alertDisplayReadModel]
    .sort(compareAlertsByTriggeredAtDesc)
    .map(toTrackingAlertResponse)
  const processOperational = toProcessOperationalResponse(summariesForProcess)
  const trackingValidationSummary = aggregateTrackingValidationProjection(
    validationSummariesForProcess,
  )
  const trackingValidationTopIssue = pickTopTrackingValidationIssueForProcess(
    containersWithTracking.map((container) => ({
      containerNumber: container.container_number,
      topIssue: trackingValidationByContainerId.get(container.id)?.topIssue ?? null,
    })),
  )
  const trackingValidation = toProcessTrackingValidationResponse(
    trackingValidationSummary,
    trackingValidationTopIssue,
  )
  const activeAlertIncidentResponses = activeAlertIncidents.active.map(
    toShipmentAlertIncidentResponse,
  )
  const trackingFreshnessToken = toTrackingFreshnessToken({
    containers,
    alerts: alertsResponse,
    activeAlertIncidents: activeAlertIncidentResponses,
    processOperational,
    trackingValidation,
  })

  return {
    ...processToResponseFields(pwc.process),
    tracking_freshness_token: trackingFreshnessToken,
    containers,
    containersSync: containersSync.map(toContainerSyncResponse),
    alerts: alertsResponse,
    attention_severity: toProcessAttentionSeverity({
      highestAlertSeverity: alertsResponse.reduce<'info' | 'warning' | 'danger' | null>(
        (current, alert) => {
          if (alert.severity === 'danger') return 'danger'
          if (alert.severity === 'warning' && current !== 'danger') return 'warning'
          if (alert.severity === 'info' && current === null) return 'info'
          return current
        },
        null,
      ),
      trackingValidation: trackingValidationSummary,
    }),
    tracking_validation: trackingValidation,
    alert_incidents: {
      summary: {
        active_incidents: activeAlertIncidents.summary.activeIncidentCount,
        affected_containers: activeAlertIncidents.summary.affectedContainerCount,
        recognized_incidents: activeAlertIncidents.summary.recognizedIncidentCount,
      },
      active: activeAlertIncidentResponses,
    },
    process_operational: processOperational,
  }
}

export function toProcessSyncSnapshotResponse(command: {
  readonly trackingFreshnessToken: string
  readonly containersSync: readonly ContainerSyncRecord[]
}) {
  return {
    tracking_freshness_token: command.trackingFreshnessToken,
    containersSync: command.containersSync.map(toContainerSyncResponse),
  }
}

export function toRecognizedAlertIncidentsResponse(
  alertIncidents: ShipmentAlertIncidentsReadModel,
) {
  return {
    summary: {
      active_incidents: alertIncidents.summary.activeIncidentCount,
      affected_containers: alertIncidents.summary.affectedContainerCount,
      recognized_incidents: alertIncidents.summary.recognizedIncidentCount,
    },
    recognized: alertIncidents.recognized.map(toShipmentAlertIncidentResponse),
  }
}
