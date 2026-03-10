import { describe, expect, it } from 'vitest'
import { aggregateOperationalSummary } from '~/modules/process/application/usecases/list-processes-with-operational-summary.usecase'
import type { OperationalStatus } from '~/modules/process/features/operational-projection/application/operationalSemantics'

type TrackingAlertLike = {
  readonly id: string
  readonly type: string
  readonly severity: string
  readonly triggered_at: string
}

function makeAlert(overrides: Partial<TrackingAlertLike> = {}): TrackingAlertLike {
  return {
    id: 'alert-1',
    type: 'TRANSSHIPMENT',
    severity: 'warning',
    triggered_at: '2026-03-03T00:00:00.000Z',
    ...overrides,
  }
}

function makeSummary(
  overrides: {
    status?: OperationalStatus
    alerts?: readonly TrackingAlertLike[]
    observations?: readonly { event_time: string | null }[]
    operational?: {
      etaEventTimeIso?: string | null
      etaApplicable?: boolean
      lifecycleBucket?: 'pre_arrival' | 'post_arrival_pre_delivery' | 'final_delivery'
    }
  } = {},
) {
  const etaEventTimeIso = overrides.operational?.etaEventTimeIso
  const operational = overrides.operational
    ? {
        eta:
          typeof etaEventTimeIso === 'string' && etaEventTimeIso.length > 0
            ? { eventTimeIso: etaEventTimeIso }
            : null,
        etaApplicable: overrides.operational.etaApplicable,
        lifecycleBucket: overrides.operational.lifecycleBucket,
      }
    : undefined

  return {
    status: overrides.status ?? 'UNKNOWN',
    operational,
    alerts: overrides.alerts ?? [],
    timeline: {
      observations: overrides.observations ?? [],
    },
  }
}

describe('aggregateOperationalSummary', () => {
  it('returns UNKNOWN status when no containers', () => {
    const result = aggregateOperationalSummary('p1', 'REF-1', 'maersk', 0, [])

    expect(result.process_status).toBe('UNKNOWN')
    expect(result.eta).toBeNull()
    expect(result.alerts_count).toBe(0)
    expect(result.highest_alert_severity).toBeNull()
    expect(result.dominant_alert_created_at).toBeNull()
    expect(result.has_transshipment).toBe(false)
    expect(result.last_event_at).toBeNull()
  })

  it('aggregates status using conservative (lowest) logic', () => {
    const summaries = [
      makeSummary({ status: 'IN_PROGRESS' }),
      makeSummary({ status: 'IN_TRANSIT' }),
      makeSummary({ status: 'LOADED' }),
    ]

    const result = aggregateOperationalSummary('p1', null, null, 3, summaries)

    expect(result.process_status).toBe('AWAITING_DATA')
  })

  it('returns AWAITING_DATA when containers exist but no observations were ingested', () => {
    const summaries = [makeSummary({ status: 'UNKNOWN' }), makeSummary({ status: 'IN_PROGRESS' })]

    const result = aggregateOperationalSummary('p1', null, null, 2, summaries)

    expect(result.process_status).toBe('AWAITING_DATA')
  })

  it('returns UNKNOWN when all containers are UNKNOWN and there is no tracking evidence', () => {
    const summaries = [makeSummary({ status: 'UNKNOWN' }), makeSummary({ status: 'UNKNOWN' })]

    const result = aggregateOperationalSummary('p1', null, null, 2, summaries)

    expect(result.process_status).toBe('UNKNOWN')
  })

  it('returns IN_TRANSIT when observations exist and at least one container is in transit phase', () => {
    const summaries = [
      makeSummary({
        status: 'IN_PROGRESS',
        observations: [{ event_time: '2026-03-01T00:00:00.000Z' }],
      }),
      makeSummary({
        status: 'LOADED',
        observations: [{ event_time: '2026-03-02T00:00:00.000Z' }],
      }),
    ]

    const result = aggregateOperationalSummary('p1', null, null, 2, summaries)

    expect(result.process_status).toBe('IN_TRANSIT')
  })

  it('selects earliest future ETA among containers', () => {
    const futureDate1 = new Date(Date.now() + 86400000).toISOString() // tomorrow
    const futureDate2 = new Date(Date.now() + 172800000).toISOString() // day after tomorrow
    const pastDate = new Date(Date.now() - 86400000).toISOString() // yesterday

    const summaries = [
      makeSummary({
        status: 'IN_TRANSIT',
        operational: {
          etaEventTimeIso: futureDate2,
          etaApplicable: true,
          lifecycleBucket: 'pre_arrival',
        },
        observations: [{ event_time: pastDate }, { event_time: futureDate2 }],
      }),
      makeSummary({
        status: 'IN_TRANSIT',
        operational: {
          etaEventTimeIso: futureDate1,
          etaApplicable: true,
          lifecycleBucket: 'pre_arrival',
        },
        observations: [{ event_time: futureDate1 }],
      }),
    ]

    const result = aggregateOperationalSummary('p1', null, null, 2, summaries)

    expect(result.eta).toBe(futureDate1)
  })

  it('returns null ETA when no future events', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString()

    const summaries = [
      makeSummary({
        status: 'IN_TRANSIT',
        operational: {
          etaEventTimeIso: pastDate,
          etaApplicable: true,
          lifecycleBucket: 'pre_arrival',
        },
        observations: [{ event_time: pastDate }],
      }),
    ]

    const result = aggregateOperationalSummary('p1', null, null, 1, summaries)

    expect(result.eta).toBeNull()
  })

  it('counts alerts across all containers', () => {
    const summaries = [
      makeSummary({
        alerts: [
          makeAlert({ id: 'a1', severity: 'info', type: 'NO_MOVEMENT' }),
          makeAlert({ id: 'a2', severity: 'warning', type: 'TRANSSHIPMENT' }),
        ],
      }),
      makeSummary({
        alerts: [makeAlert({ id: 'a3', severity: 'danger', type: 'PORT_CHANGE' })],
      }),
    ]

    const result = aggregateOperationalSummary('p1', null, null, 2, summaries)

    expect(result.alerts_count).toBe(3)
  })

  it('selects highest alert severity across containers', () => {
    const summaries = [
      makeSummary({
        alerts: [
          makeAlert({
            severity: 'info',
            type: 'NO_MOVEMENT',
            triggered_at: '2026-03-03T10:00:00.000Z',
          }),
        ],
      }),
      makeSummary({
        alerts: [
          makeAlert({
            severity: 'warning',
            type: 'TRANSSHIPMENT',
            triggered_at: '2026-03-03T11:00:00.000Z',
          }),
        ],
      }),
    ]

    const result = aggregateOperationalSummary('p1', null, null, 2, summaries)

    expect(result.highest_alert_severity).toBe('warning')
    expect(result.dominant_alert_created_at).toBe('2026-03-03T11:00:00.000Z')
  })

  it('danger severity takes precedence over all', () => {
    const summaries = [
      makeSummary({
        alerts: [
          makeAlert({
            severity: 'info',
            type: 'NO_MOVEMENT',
            triggered_at: '2026-03-03T09:00:00.000Z',
          }),
          makeAlert({
            severity: 'danger',
            type: 'PORT_CHANGE',
            triggered_at: '2026-03-03T08:00:00.000Z',
          }),
          makeAlert({
            severity: 'warning',
            type: 'TRANSSHIPMENT',
            triggered_at: '2026-03-03T11:00:00.000Z',
          }),
        ],
      }),
    ]

    const result = aggregateOperationalSummary('p1', null, null, 1, summaries)

    expect(result.highest_alert_severity).toBe('danger')
    expect(result.dominant_alert_created_at).toBe('2026-03-03T08:00:00.000Z')
  })

  it('uses latest triggered_at when dominant severity ties', () => {
    const summaries = [
      makeSummary({
        alerts: [
          makeAlert({
            id: 'a1',
            severity: 'warning',
            type: 'NO_MOVEMENT',
            triggered_at: '2026-03-03T10:00:00.000Z',
          }),
        ],
      }),
      makeSummary({
        alerts: [
          makeAlert({
            id: 'a2',
            severity: 'warning',
            type: 'ETA_PASSED',
            triggered_at: '2026-03-03T11:00:00.000Z',
          }),
        ],
      }),
    ]

    const result = aggregateOperationalSummary('p1', null, null, 2, summaries)

    expect(result.highest_alert_severity).toBe('warning')
    expect(result.dominant_alert_created_at).toBe('2026-03-03T11:00:00.000Z')
  })

  it('detects transshipment alert at process level', () => {
    const summaries = [
      makeSummary({
        alerts: [makeAlert({ type: 'TRANSSHIPMENT' })],
      }),
      makeSummary({ alerts: [] }),
    ]

    const result = aggregateOperationalSummary('p1', null, null, 2, summaries)

    expect(result.has_transshipment).toBe(true)
  })

  it('returns false for transshipment when no such alert', () => {
    const summaries = [
      makeSummary({
        alerts: [makeAlert({ type: 'NO_MOVEMENT' })],
      }),
    ]

    const result = aggregateOperationalSummary('p1', null, null, 1, summaries)

    expect(result.has_transshipment).toBe(false)
  })

  it('finds the latest event_time across all containers', () => {
    const date1 = '2025-01-01T00:00:00Z'
    const date2 = '2025-06-15T12:00:00Z'
    const date3 = '2025-03-10T08:00:00Z'

    const summaries = [
      makeSummary({ observations: [{ event_time: date1 }, { event_time: date3 }] }),
      makeSummary({ observations: [{ event_time: date2 }] }),
    ]

    const result = aggregateOperationalSummary('p1', null, null, 2, summaries)

    expect(result.last_event_at).toBe(date2)
  })

  it('skips null event_times for last_event_at', () => {
    const date1 = '2025-01-01T00:00:00Z'

    const summaries = [makeSummary({ observations: [{ event_time: null }, { event_time: date1 }] })]

    const result = aggregateOperationalSummary('p1', null, null, 1, summaries)

    expect(result.last_event_at).toBe(date1)
  })

  it('preserves process metadata', () => {
    const result = aggregateOperationalSummary('proc-123', 'REF-X', 'msc', 3, [])

    expect(result.process_id).toBe('proc-123')
    expect(result.reference).toBe('REF-X')
    expect(result.carrier).toBe('msc')
    expect(result.container_count).toBe(3)
  })
})
