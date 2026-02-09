import { describe, expect, it } from 'vitest'
import {
  type ProcessApiResponse,
  presentProcess,
} from '~/modules/process/application/processPresenter'

describe('processPresenter', () => {
  it('presents a minimal API payload into shipment detail', () => {
    const example: ProcessApiResponse = {
      id: 'proc-1',
      reference: 'REF-1',
      operation_type: 'import',
      origin: { display_name: 'Shanghai' },
      destination: { display_name: 'Santos' },
      carrier: 'maersk',
      bl_reference: null,
      source: 'api',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      containers: [
        {
          id: 'c1',
          container_number: 'MRKU1234567',
          container_type: '40HC',
          carrier_code: 'MAERSK',
          status: 'LOADED',
          observations: [
            {
              id: 'obs-1',
              fingerprint: 'abc123',
              type: 'LOAD',
              event_time: new Date().toISOString(),
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

    const result = presentProcess(example)
    expect(result).toBeTruthy()
    expect(result.id).toBe('proc-1')
    expect(Array.isArray(result.containers)).toBe(true)
    expect(result.containers[0].number).toBe('MRKU1234567')
    expect(result.containers[0].status).toBe('loaded')
    expect(result.containers[0].statusLabel).toBe('Loaded')
    expect(result.containers[0].timeline.length).toBe(1)
    expect(result.containers[0].timeline[0].label).toContain('Loaded on Vessel')
    expect(result.containers[0].timeline[0].label).toContain('MAERSK SEVILLE')
    expect(Array.isArray(result.alerts)).toBe(true)
  })

  it('presents process with alerts from tracking pipeline', () => {
    const example: ProcessApiResponse = {
      id: 'proc-2',
      reference: 'REF-2',
      operation_type: 'import',
      origin: { display_name: 'Rotterdam' },
      destination: { display_name: 'Santos' },
      carrier: 'msc',
      bl_reference: null,
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
          triggered_at: new Date().toISOString(),
          retroactive: false,
          provider: 'msc',
          acked_at: null,
          dismissed_at: null,
        },
      ],
    }

    const result = presentProcess(example)
    expect(result.status).toBe('in-transit')
    expect(result.statusLabel).toBe('In Transit')
    expect(result.alerts.length).toBe(1)
    expect(result.alerts[0].type).toBe('transshipment')
    expect(result.alerts[0].severity).toBe('warning')
    expect(result.alerts[0].category).toBe('fact')
  })

  it('filters out dismissed alerts', () => {
    const example: ProcessApiResponse = {
      id: 'proc-3',
      reference: null,
      operation_type: 'import',
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

    const result = presentProcess(example)
    expect(result.alerts.length).toBe(0)
  })

  it('shows placeholder timeline when no observations', () => {
    const example: ProcessApiResponse = {
      id: 'proc-4',
      reference: 'EMPTY',
      operation_type: 'unknown',
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

    const result = presentProcess(example)
    expect(result.containers[0].timeline.length).toBe(1)
    expect(result.containers[0].timeline[0].id).toBe('system-created')
    expect(result.containers[0].status).toBe('unknown')
  })
})
