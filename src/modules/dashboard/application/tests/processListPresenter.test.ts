import { describe, expect, it } from 'vitest'
import {
  type ProcessApiResponse,
  presentProcessList,
} from '~/modules/dashboard/application/processListPresenter'

describe('presentProcessList', () => {
  it('maps API response to ProcessSummary array', () => {
    const example: ProcessApiResponse[] = [
      {
        id: 'p1',
        reference: 'REF1',
        origin: { display_name: 'Shanghai' },
        destination: { display_name: 'Santos' },
        carrier: 'Maersk',
        bill_of_lading: null,
        booking_number: null,
        source: 'api',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        containers: [{ id: 'c1', container_number: 'MRKU1111111', carrier_code: null }],
      },
    ]

    const result = presentProcessList(example)
    expect(Array.isArray(result)).toBe(true)
    expect(result[0].id).toBe('p1')
    expect(result[0].containerCount).toBe(1)
    expect(result[0].carrier).toBe('Maersk')
  })

  it('maps process_status from API to correct StatusVariant', () => {
    const example: ProcessApiResponse[] = [
      {
        id: 'p2',
        reference: 'REF2',
        carrier: 'MSC',
        source: 'api',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        containers: [{ id: 'c2', container_number: 'MSCU1111111' }],
        process_status: 'IN_TRANSIT',
        eta: '2025-06-01T00:00:00Z',
        alerts_count: 2,
        highest_alert_severity: 'warning',
        has_transshipment: true,
        last_event_at: '2025-05-01T00:00:00Z',
      },
    ]

    const result = presentProcessList(example)
    expect(result[0].status).toBe('in-transit')
    expect(result[0].statusLabel).toBe('In Transit')
    expect(result[0].eta).toBe('2025-06-01T00:00:00Z')
    expect(result[0].alertsCount).toBe(2)
    expect(result[0].highestAlertSeverity).toBe('warning')
    expect(result[0].hasTransshipment).toBe(true)
    expect(result[0].lastEventAt).toBe('2025-05-01T00:00:00Z')
  })

  it('defaults to unknown status when process_status is absent', () => {
    const example: ProcessApiResponse[] = [
      {
        id: 'p3',
        source: 'api',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        containers: [],
      },
    ]

    const result = presentProcessList(example)
    expect(result[0].status).toBe('unknown')
    expect(result[0].statusLabel).toBe('Awaiting data')
    expect(result[0].eta).toBeNull()
    expect(result[0].alertsCount).toBe(0)
    expect(result[0].highestAlertSeverity).toBeNull()
    expect(result[0].hasTransshipment).toBe(false)
    expect(result[0].lastEventAt).toBeNull()
  })

  it('maps DELIVERED status correctly', () => {
    const example: ProcessApiResponse[] = [
      {
        id: 'p4',
        source: 'api',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        containers: [],
        process_status: 'DELIVERED',
      },
    ]

    const result = presentProcessList(example)
    expect(result[0].status).toBe('delivered')
    expect(result[0].statusLabel).toBe('Delivered')
  })
})
