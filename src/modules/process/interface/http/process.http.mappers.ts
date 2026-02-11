import type { ContainerEntity } from '~/modules/container/domain/container.entity'
import type { ProcessWithContainers } from '~/modules/process/application/process.readmodels'
import type {
  InsertProcessRecord,
  UpdateProcessRecord,
} from '~/modules/process/application/process.records'

import type { ProcessEntity } from '~/modules/process/domain/process.entity'
import type { CreateProcessInput } from '~/modules/process/interface/http/process.schemas'
import type { Observation } from '~/modules/tracking/domain/observation'
import type { TrackingAlert } from '~/modules/tracking/domain/trackingAlert'

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

function toContainerResponse(c: ContainerEntity) {
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

// ---------------------------------------------------------------------------
// Tracking data → Response DTO
// ---------------------------------------------------------------------------

function toObservationResponse(obs: Observation) {
  return {
    id: obs.id,
    fingerprint: obs.fingerprint,
    type: obs.type,
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

function toTrackingAlertResponse(a: TrackingAlert) {
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

/**
 * Maps a container entity + its tracking summary to the detail response shape.
 * If tracking fetch fails, returns a fallback with status 'UNKNOWN' and empty observations.
 */
export function toContainerWithTrackingResponse(
  c: ContainerEntity,
  summary: {
    status: string
    observations: readonly Observation[]
  },
) {
  return {
    ...toContainerResponse(c),
    status: summary.status,
    observations: summary.observations.map(toObservationResponse),
  }
}

export function toContainerWithTrackingFallback(c: ContainerEntity) {
  return {
    ...toContainerResponse(c),
    status: 'UNKNOWN',
    observations: [],
  }
}

export function toProcessDetailResponse(
  pwc: ProcessWithContainers,
  containersWithTracking: {
    id: string
    container_number: string
    carrier_code: string | null
    status: string
    observations: ReturnType<typeof toObservationResponse>[]
  }[],
  alerts: readonly TrackingAlert[],
) {
  return {
    ...processToResponseFields(pwc.process),
    containers: [...containersWithTracking],
    alerts: alerts.map(toTrackingAlertResponse),
  }
}
