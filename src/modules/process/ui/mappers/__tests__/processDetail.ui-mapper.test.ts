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
