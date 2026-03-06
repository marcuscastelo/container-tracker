import { describe, expect, it } from 'vitest'
import {
  type ProcessListItemSource,
  toProcessSummaryVMs,
} from '~/modules/process/ui/mappers/processList.ui-mapper'

function makeSource(overrides: Partial<ProcessListItemSource> = {}): ProcessListItemSource {
  return {
    id: 'p-default',
    source: 'api',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    containers: [],
    ...overrides,
  }
}

describe('toProcessSummaryVMs', () => {
  it('maps API response to ProcessSummaryVM array', () => {
    const example: ProcessListItemSource[] = [
      {
        id: 'p1',
        reference: 'REF1',
        origin: { display_name: 'Shanghai' },
        destination: { display_name: 'Santos' },
        carrier: 'Maersk',
        importer_id: 'importer-1',
        importer_name: 'Empresa ABC',
        bill_of_lading: null,
        booking_number: null,
        source: 'api',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        containers: [{ id: 'c1', container_number: 'MRKU1111111', carrier_code: null }],
      },
    ]

    const result = toProcessSummaryVMs(example)
    expect(Array.isArray(result)).toBe(true)
    expect(result[0].id).toBe('p1')
    expect(result[0].containerCount).toBe(1)
    expect(result[0].containerNumbers).toEqual(['MRKU1111111'])
    expect(result[0].carrier).toBe('Maersk')
    expect(result[0].importerId).toBe('importer-1')
    expect(result[0].importerName).toBe('Empresa ABC')
    expect(result[0].syncStatus).toBe('idle')
    expect(result[0].lastSyncAt).toBeNull()
  })

  it('maps process_status from API to status code + StatusVariant', () => {
    const example: ProcessListItemSource[] = [
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
        last_sync_status: 'DONE',
        last_sync_at: '2025-05-01T11:00:00Z',
      },
    ]

    const result = toProcessSummaryVMs(example)
    expect(result[0].status).toBe('in-transit')
    expect(result[0].statusCode).toBe('IN_TRANSIT')
    expect(result[0].statusRank).toBeGreaterThan(0)
    expect(result[0].eta).toBe('2025-06-01T00:00:00Z')
    expect(result[0].etaMsOrNull).toBe(Date.parse('2025-06-01T00:00:00Z'))
    expect(result[0].alertsCount).toBe(2)
    expect(result[0].highestAlertSeverity).toBe('warning')
    expect(result[0].hasTransshipment).toBe(true)
    expect(result[0].lastEventAt).toBe('2025-05-01T00:00:00Z')
    expect(result[0].syncStatus).toBe('idle')
    expect(result[0].lastSyncAt).toBe('2025-05-01T11:00:00Z')
  })

  it('defaults to unknown status when process_status is absent', () => {
    const result = toProcessSummaryVMs([makeSource({ id: 'p3' })])
    expect(result[0].status).toBe('unknown')
    expect(result[0].statusCode).toBe('UNKNOWN')
    expect(result[0].statusRank).toBe(0)
    expect(result[0].eta).toBeNull()
    expect(result[0].etaMsOrNull).toBeNull()
    expect(result[0].alertsCount).toBe(0)
    expect(result[0].highestAlertSeverity).toBeNull()
    expect(result[0].hasTransshipment).toBe(false)
    expect(result[0].lastEventAt).toBeNull()
    expect(result[0].syncStatus).toBe('idle')
    expect(result[0].lastSyncAt).toBeNull()
  })

  it('maps sync metadata to dashboard sync visual states', () => {
    const result = toProcessSummaryVMs([
      makeSource({
        id: 'p-sync-running',
        last_sync_status: 'RUNNING',
        last_sync_at: '2026-03-05T10:00:00.000Z',
      }),
      makeSource({ id: 'p-sync-failed', last_sync_status: 'FAILED' }),
      makeSource({ id: 'p-sync-unknown', last_sync_status: 'UNKNOWN' }),
    ])

    expect(result[0].syncStatus).toBe('syncing')
    expect(result[0].lastSyncAt).toBe('2026-03-05T10:00:00.000Z')
    expect(result[1].syncStatus).toBe('idle')
    expect(result[2].syncStatus).toBe('idle')
  })

  it('maps DELIVERED status correctly', () => {
    const result = toProcessSummaryVMs([makeSource({ id: 'p4', process_status: 'DELIVERED' })])
    expect(result[0].status).toBe('delivered')
    expect(result[0].statusCode).toBe('DELIVERED')
    expect(result[0].statusRank).toBeGreaterThan(0)
  })

  it('maps invalid eta string to etaMsOrNull = null', () => {
    const result = toProcessSummaryVMs([makeSource({ id: 'p7', eta: 'not-a-date' })])
    expect(result[0].eta).toBe('not-a-date')
    expect(result[0].etaMsOrNull).toBeNull()
  })

  it('normalizes blank importer_name to null', () => {
    const result = toProcessSummaryVMs([makeSource({ id: 'p5', importer_name: '   ' })])
    expect(result[0].importerId).toBeNull()
    expect(result[0].importerName).toBeNull()
  })

  it('preserves leading/trailing whitespace in non-blank importer_name', () => {
    const result = toProcessSummaryVMs([makeSource({ id: 'p6', importer_name: '  Empresa ABC  ' })])
    expect(result[0].importerName).toBe('  Empresa ABC  ')
  })

  it('maps redestination_number to redestinationNumber', () => {
    const result = toProcessSummaryVMs([
      makeSource({ id: 'p-redest', redestination_number: 'RD-12345' }),
    ])
    expect(result[0].redestinationNumber).toBe('RD-12345')
  })

  it('defaults redestinationNumber to null when absent', () => {
    const result = toProcessSummaryVMs([makeSource({ id: 'p-no-redest' })])
    expect(result[0].redestinationNumber).toBeNull()
  })

  it('normalizes null redestination_number to null', () => {
    const result = toProcessSummaryVMs([
      makeSource({ id: 'p-null-redest', redestination_number: null }),
    ])
    expect(result[0].redestinationNumber).toBeNull()
  })
})
