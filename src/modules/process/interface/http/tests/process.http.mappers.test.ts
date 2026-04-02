import { describe, expect, it } from 'vitest'
import type { ProcessSyncSummaryReadModel } from '~/modules/process/application/usecases/list-processes-with-operational-summary.usecase'
import { toCarrierCode } from '~/modules/process/domain/identity/carrier-code.vo'
import { toProcessId } from '~/modules/process/domain/identity/process-id.vo'
import { toProcessReference } from '~/modules/process/domain/identity/process-reference.vo'
import { toProcessSource } from '~/modules/process/domain/identity/process-source.vo'
import { createProcessEntity } from '~/modules/process/domain/process.entity'
import type { ProcessOperationalSummary } from '~/modules/process/features/operational-projection/application/processOperationalSummary'
import {
  toProcessResponseWithSummary,
  toUpdateProcessRecord,
} from '~/modules/process/interface/http/process.http.mappers'
import type { CreateProcessInput } from '~/modules/process/interface/http/process.schemas'
import { ProcessResponseSchema } from '~/shared/api-schemas/processes.schemas'
import { Instant } from '~/shared/time/instant'

function createProcessWithContainers() {
  const process = createProcessEntity({
    id: toProcessId('process-http-1'),
    reference: toProcessReference('REF-HTTP-1'),
    origin: 'Shanghai',
    destination: 'Santos',
    carrier: toCarrierCode('msc'),
    billOfLading: null,
    bookingNumber: null,
    importerName: 'Importer A',
    exporterName: 'Exporter B',
    referenceImporter: null,
    product: null,
    redestinationNumber: null,
    source: toProcessSource('manual'),
    createdAt: Instant.fromIso('2026-03-10T10:00:00.000Z'),
    updatedAt: Instant.fromIso('2026-03-10T10:00:00.000Z'),
  })

  return {
    process,
    containers: [
      {
        id: 'container-1',
        processId: 'process-http-1',
        containerNumber: 'MSCU1234567',
        carrierCode: 'MSC',
      },
      {
        id: 'container-2',
        processId: 'process-http-1',
        containerNumber: 'MSCU7654321',
        carrierCode: 'MSC',
      },
    ],
  }
}

function createSummary(
  overrides: Partial<ProcessOperationalSummary> = {},
): ProcessOperationalSummary {
  return {
    process_id: 'process-http-1',
    reference: 'REF-HTTP-1',
    carrier: 'msc',
    container_count: 2,
    process_status: 'IN_TRANSIT',
    highest_container_status: 'DISCHARGED',
    status_counts: {
      UNKNOWN: 0,
      IN_PROGRESS: 0,
      LOADED: 0,
      IN_TRANSIT: 1,
      ARRIVED_AT_POD: 0,
      DISCHARGED: 1,
      AVAILABLE_FOR_PICKUP: 0,
      DELIVERED: 0,
      EMPTY_RETURNED: 0,
    },
    status_microbadge: {
      status: 'DISCHARGED',
      count: 1,
    },
    has_status_dispersion: true,
    eta: null,
    lifecycle_bucket: 'post_arrival_pre_delivery',
    final_delivery_complete: false,
    full_logistics_complete: false,
    eta_coverage: {
      total: 2,
      eligible_total: 2,
      with_eta: 0,
    },
    eta_display: {
      kind: 'unavailable',
    },
    alerts_count: 0,
    highest_alert_severity: null,
    dominant_alert_created_at: null,
    has_transshipment: false,
    last_event_at: null,
    ...overrides,
  }
}

function createSyncSummary(
  overrides: Partial<ProcessSyncSummaryReadModel> = {},
): ProcessSyncSummaryReadModel {
  return {
    lastSyncStatus: 'DONE',
    lastSyncAt: '2026-03-10T11:00:00.000Z',
    ...overrides,
  }
}

describe('process.http.mappers', () => {
  it('preserves explicit null values so update requests can clear process fields', () => {
    const dto: Partial<CreateProcessInput> = {
      reference: null,
      origin: null,
      destination: null,
      bill_of_lading: null,
      booking_number: null,
      importer_name: null,
      exporter_name: null,
      reference_importer: null,
      product: null,
      redestination_number: null,
    }

    expect(toUpdateProcessRecord(dto)).toEqual({
      reference: null,
      origin: null,
      destination: null,
      bill_of_lading: null,
      booking_number: null,
      importer_name: null,
      exporter_name: null,
      reference_importer: null,
      product: null,
      redestination_number: null,
    })
  })

  it('omits untouched fields from update record payload', () => {
    expect(toUpdateProcessRecord({})).toEqual({})
  })

  it('maps status microbadge fields into process list response DTO', () => {
    const response = toProcessResponseWithSummary(
      createProcessWithContainers(),
      createSummary({
        status_microbadge: {
          status: 'DISCHARGED',
          count: 2,
        },
      }),
      createSyncSummary(),
    )

    const parsed = ProcessResponseSchema.parse(response)

    expect(parsed.process_status).toBe('IN_TRANSIT')
    expect(parsed.highest_container_status).toBe('DISCHARGED')
    expect(parsed.status_counts?.DISCHARGED).toBe(1)
    expect(parsed.has_status_dispersion).toBe(true)
    expect(parsed.status_microbadge).toEqual({
      status: 'DISCHARGED',
      count: 2,
    })
  })

  it('maps delivered eta_display into process list response DTO', () => {
    const response = toProcessResponseWithSummary(
      createProcessWithContainers(),
      createSummary({
        process_status: 'DELIVERED',
        highest_container_status: 'DELIVERED',
        status_counts: {
          UNKNOWN: 0,
          IN_PROGRESS: 0,
          LOADED: 0,
          IN_TRANSIT: 0,
          ARRIVED_AT_POD: 0,
          DISCHARGED: 0,
          AVAILABLE_FOR_PICKUP: 0,
          DELIVERED: 2,
          EMPTY_RETURNED: 0,
        },
        status_microbadge: null,
        has_status_dispersion: false,
        lifecycle_bucket: 'final_delivery',
        final_delivery_complete: true,
        eta: null,
        eta_display: {
          kind: 'delivered',
        },
      }),
      createSyncSummary(),
    )

    const parsed = ProcessResponseSchema.parse(response)

    expect(parsed.eta).toBeNull()
    expect(parsed.eta_display).toEqual({
      kind: 'delivered',
    })
  })

  it('keeps status microbadge nullable when there is no advanced subset status', () => {
    const response = toProcessResponseWithSummary(
      createProcessWithContainers(),
      createSummary({
        process_status: 'UNKNOWN',
        highest_container_status: 'UNKNOWN',
        status_counts: {
          UNKNOWN: 2,
          IN_PROGRESS: 0,
          LOADED: 0,
          IN_TRANSIT: 0,
          ARRIVED_AT_POD: 0,
          DISCHARGED: 0,
          AVAILABLE_FOR_PICKUP: 0,
          DELIVERED: 0,
          EMPTY_RETURNED: 0,
        },
        status_microbadge: null,
        has_status_dispersion: false,
      }),
      createSyncSummary({
        lastSyncStatus: 'UNKNOWN',
        lastSyncAt: null,
      }),
    )

    const parsed = ProcessResponseSchema.parse(response)

    expect(parsed.process_status).toBe('UNKNOWN')
    expect(parsed.status_microbadge).toBeNull()
    expect(parsed.has_status_dispersion).toBe(false)
    expect(parsed.status_counts?.UNKNOWN).toBe(2)
  })
})
