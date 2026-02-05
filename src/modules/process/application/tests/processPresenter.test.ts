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
      carrier: 'Maersk',
      bl_reference: null,
      source: 'api',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      containers: [
        {
          id: 'c1',
          container_number: 'MRKU1234567',
          iso_type: '40HC',
          initial_status: 'booked',
          eta: null,
          events: [
            {
              id: 'e1',
              activity: 'Loaded',
              event_time: new Date().toISOString(),
              event_time_type: 'ACTUAL',
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
    expect(Array.isArray(result.alerts)).toBe(true)
  })
})
