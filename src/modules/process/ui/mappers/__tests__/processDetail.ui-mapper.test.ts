import { describe, expect, it } from 'vitest'
import { toShipmentDetailVM } from '~/modules/process/ui/mappers/processDetail.ui-mapper'
import type { ProcessDetailResponse } from '~/shared/api-schemas/processes.schemas'

describe('toShipmentDetailVM', () => {
  it('maps a minimal API payload into shipment detail view model', () => {
    const example: ProcessDetailResponse = {
      id: 'proc-1',
      reference: 'REF-1',
      origin: { display_name: 'Shanghai' },
      destination: { display_name: 'Santos' },
      carrier: 'maersk',
      bill_of_lading: null,
      booking_number: null,
      source: 'api',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      containers: [
        {
          id: 'c1',
          container_number: 'MRKU1234567',
          carrier_code: 'MAERSK',
          status: 'LOADED',
          observations: [
            {
              id: 'obs-1',
              fingerprint: 'abc123',
              type: 'LOAD',
              event_time: new Date().toISOString(),
              event_time_type: 'ACTUAL',
              location_code: 'CNSHA',
              location_display: 'Shanghai',
              vessel_name: 'MAERSK SEVILLE',
              voyage: '123W',
              is_empty: false,
              confidence: 'confirmed',
              provider: 'maersk',
              retroactive: false,
              created_at: new Date().toISOString(),
            },
          ],
        },
      ],
      alerts: [],
    }

    const result = toShipmentDetailVM(example)
    expect(result).toBeTruthy()
    expect(result.id).toBe('proc-1')
    expect(Array.isArray(result.containers)).toBe(true)
    expect(result.containers[0].number).toBe('MRKU1234567')
    expect(result.containers[0].status).toBe('loaded')
    expect(result.containers[0].statusCode).toBe('LOADED')
    expect(result.containers[0].timeline.length).toBe(1)
    expect(result.containers[0].timeline[0].type).toBe('LOAD')
    expect(result.containers[0].timeline[0].vesselName).toBe('MAERSK SEVILLE')
    expect(result.containers[0].timeline[0].voyage).toBe('123W')
    expect(result.containers[0].etaChipVm.state).toBe('UNAVAILABLE')
    expect(result.containers[0].dataIssueChipVm.visible).toBe(false)
    expect(result.processEtaSecondaryVm.visible).toBe(false)
    expect(result.processEtaSecondaryVm.total).toBe(1)
    expect(Array.isArray(result.alerts)).toBe(true)
  })

  it('maps process-level status and alerts from tracking data', () => {
    const example: ProcessDetailResponse = {
      id: 'proc-2',
      reference: 'REF-2',
      origin: { display_name: 'Rotterdam' },
      destination: { display_name: 'Santos' },
      carrier: 'msc',
      bill_of_lading: null,
      booking_number: null,
      source: 'api',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      containers: [
        {
          id: 'c2',
          container_number: 'MSCU1234567',
          status: 'IN_TRANSIT',
          observations: [],
        },
      ],
      alerts: [
        {
          id: 'alert-1',
          category: 'fact',
          type: 'TRANSSHIPMENT',
          severity: 'warning',
          message: 'Transshipment detected: 1 intermediate port(s)',
          detected_at: new Date().toISOString(),
          triggered_at: '2026-02-01T10:00:00.000Z',
          retroactive: false,
          provider: 'msc',
          acked_at: null,
          dismissed_at: null,
        },
      ],
    }

    const result = toShipmentDetailVM(example)
    expect(result.status).toBe('in-transit')
    expect(result.statusCode).toBe('IN_TRANSIT')
    expect(result.alerts.length).toBe(1)
    expect(result.alerts[0].type).toBe('transshipment')
    expect(result.alerts[0].severity).toBe('warning')
    expect(result.alerts[0].category).toBe('fact')
    expect(result.alerts[0].triggeredAtIso).toBe('2026-02-01T10:00:00.000Z')
  })

  it('filters out dismissed alerts', () => {
    const example: ProcessDetailResponse = {
      id: 'proc-3',
      reference: null,
      origin: null,
      destination: null,
      carrier: null,
      source: 'api',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      containers: [{ id: 'c3', container_number: 'TEST1234567' }],
      alerts: [
        {
          id: 'alert-dismissed',
          category: 'monitoring',
          type: 'NO_MOVEMENT',
          severity: 'warning',
          message: 'No movement for 10 days',
          detected_at: new Date().toISOString(),
          triggered_at: new Date().toISOString(),
          retroactive: false,
          provider: null,
          acked_at: null,
          dismissed_at: new Date().toISOString(),
        },
      ],
    }

    const result = toShipmentDetailVM(example)
    expect(result.alerts.length).toBe(0)
  })

  it('shows placeholder timeline when no observations', () => {
    const example: ProcessDetailResponse = {
      id: 'proc-4',
      reference: 'EMPTY',
      origin: null,
      destination: null,
      carrier: null,
      source: 'api',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      containers: [
        {
          id: 'c4',
          container_number: 'NONE1234567',
          status: 'UNKNOWN',
          observations: [],
        },
      ],
      alerts: [],
    }

    const result = toShipmentDetailVM(example)
    expect(result.containers[0].timeline.length).toBe(1)
    expect(result.containers[0].timeline[0].id).toBe('system-created')
    expect(result.containers[0].status).toBe('unknown')
  })
})

describe('toShipmentDetailVM operational mapping', () => {
  it('maps ETA and transshipment operational chips for multi-container view', () => {
    const example: ProcessDetailResponse = {
      id: 'proc-5',
      reference: 'OPS-5',
      origin: { display_name: 'Shanghai' },
      destination: { display_name: 'Santos' },
      carrier: 'msc',
      source: 'api',
      created_at: '2026-02-01T10:00:00.000Z',
      updated_at: '2026-02-01T10:00:00.000Z',
      containers: [
        {
          id: 'c5-1',
          container_number: 'MSCU1111111',
          status: 'IN_TRANSIT',
          observations: [],
          operational: {
            status: 'IN_TRANSIT',
            eta: {
              event_time: '2026-02-20T10:00:00.000Z',
              event_time_type: 'EXPECTED',
              state: 'EXPIRED_EXPECTED',
              type: 'ARRIVAL',
              location_code: 'BRSSZ',
              location_display: 'Santos',
            },
            transshipment: {
              has_transshipment: true,
              count: 2,
              ports: [
                { code: 'ESALG', display: 'Algeciras' },
                { code: 'ITGIT', display: 'Gioia Tauro' },
              ],
            },
            data_issue: true,
          },
        },
        {
          id: 'c5-2',
          container_number: 'MSCU2222222',
          status: 'IN_TRANSIT',
          observations: [],
          operational: {
            status: 'IN_TRANSIT',
            eta: {
              event_time: '2026-02-25T10:00:00.000Z',
              event_time_type: 'EXPECTED',
              state: 'ACTIVE_EXPECTED',
              type: 'DISCHARGE',
              location_code: 'BRSSZ',
              location_display: 'Santos',
            },
            transshipment: {
              has_transshipment: false,
              count: 0,
              ports: [],
            },
            data_issue: false,
          },
        },
      ],
      alerts: [],
      process_operational: {
        eta_max: {
          event_time: '2026-02-25T10:00:00.000Z',
          event_time_type: 'EXPECTED',
          state: 'ACTIVE_EXPECTED',
          type: 'DISCHARGE',
          location_code: 'BRSSZ',
          location_display: 'Santos',
        },
        coverage: {
          total: 2,
          with_eta: 1,
        },
      },
    }

    const result = toShipmentDetailVM(example, 'pt-BR')

    expect(result.containers[0].etaChipVm.state).toBe('EXPIRED_EXPECTED')
    expect(result.containers[0].tsChipVm.visible).toBe(true)
    expect(result.containers[0].tsChipVm.count).toBe(2)
    expect(result.containers[0].dataIssueChipVm.visible).toBe(true)
    expect(result.processEtaSecondaryVm.visible).toBe(true)
    expect(result.processEtaSecondaryVm.total).toBe(2)
    expect(result.processEtaSecondaryVm.withEta).toBe(1)
    expect(result.processEtaSecondaryVm.incomplete).toBe(true)
  })
})
