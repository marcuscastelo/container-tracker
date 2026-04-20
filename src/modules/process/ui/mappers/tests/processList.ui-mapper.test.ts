import { describe, expect, it } from 'vitest'
import {
  type ProcessListItemSource,
  toProcessSummaryVMs,
} from '~/modules/process/ui/mappers/processList.ui-mapper'
import { Instant } from '~/shared/time/instant'
import { temporalDtoFromCanonical } from '~/shared/time/tests/helpers'

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

function requireAt<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined) {
    throw new Error(`Expected item at index ${index}`)
  }
  return item
}

function assertMapsApiResponseToProcessSummaryVMArray(): void {
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
  const first = requireAt(result, 0)
  expect(Array.isArray(result)).toBe(true)
  expect(first.id).toBe('p1')
  expect(first.containerCount).toBe(1)
  expect(first.containerNumbers).toEqual(['MRKU1111111'])
  expect(first.carrier).toBe('Maersk')
  expect(first.importerId).toBe('importer-1')
  expect(first.importerName).toBe('Empresa ABC')
  expect(first.syncStatus).toBe('idle')
  expect(first.lastSyncAt).toBeNull()
  expect(first.dominantIncident).toBeNull()
}

function assertMapsProcessStatusFromApiToStatusCodeAndVariant(): void {
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
      status_microbadge: {
        status: 'DISCHARGED',
        count: 2,
      },
      eta: temporalDtoFromCanonical('2025-06-01T00:00:00Z'),
      eta_display: {
        kind: 'date',
        value: temporalDtoFromCanonical('2025-06-01T00:00:00Z'),
      },
      operational_incidents: {
        summary: {
          active_incidents: 2,
          affected_containers: 1,
          recognized_incidents: 0,
        },
        dominant: {
          type: 'TRANSSHIPMENT',
          severity: 'warning',
          fact: {
            message_key: 'incidents.fact.transshipmentDetected',
            message_params: {},
          },
          triggered_at: '2025-04-29T08:00:00Z',
        },
      },
      attention_severity: 'warning',
      last_event_at: temporalDtoFromCanonical('2025-05-01T00:00:00Z'),
      last_sync_status: 'DONE',
      last_sync_at: '2025-05-01T11:00:00Z',
    },
  ]

  const result = toProcessSummaryVMs(example)
  const first = requireAt(result, 0)
  expect(first.status).toBe('blue-500')
  expect(first.statusCode).toBe('IN_TRANSIT')
  expect(first.statusMicrobadge).toEqual({
    statusCode: 'DISCHARGED',
    count: 2,
  })
  expect(first.statusRank).toBeGreaterThan(0)
  expect(first.eta).toEqual(temporalDtoFromCanonical('2025-06-01T00:00:00Z'))
  expect(first.etaDisplay).toEqual({
    kind: 'date',
    value: temporalDtoFromCanonical('2025-06-01T00:00:00Z'),
  })
  expect(first.etaMsOrNull).toBe(Date.parse('2025-06-01T00:00:00Z'))
  expect(first.activeIncidentCount).toBe(2)
  expect(first.affectedContainerCount).toBe(1)
  expect(first.recognizedIncidentCount).toBe(0)
  expect(first.dominantIncident?.severity).toBe('warning')
  expect(first.attentionSeverity).toBe('warning')
  expect(first.dominantIncident?.triggeredAt).toBe('2025-04-29T08:00:00Z')
  expect(first.dominantIncident?.type).toBe('TRANSSHIPMENT')
  expect(first.lastEventAt).toEqual(temporalDtoFromCanonical('2025-05-01T00:00:00Z'))
  expect(first.syncStatus).toBe('idle')
  expect(first.lastSyncAt).toBe('2025-05-01T11:00:00Z')
}

describe('toProcessSummaryVMs', () => {
  it('maps API response to ProcessSummaryVM array', assertMapsApiResponseToProcessSummaryVMArray)

  it(
    'maps process_status from API to status code + StatusVariant',
    assertMapsProcessStatusFromApiToStatusCodeAndVariant,
  )

  it('defaults to unknown status when process_status is absent', () => {
    const result = toProcessSummaryVMs([makeSource({ id: 'p3' })])
    const first = requireAt(result, 0)
    expect(first.status).toBe('slate-400')
    expect(first.statusCode).toBe('UNKNOWN')
    expect(first.statusMicrobadge).toBeNull()
    expect(first.statusRank).toBe(0)
    expect(first.eta).toBeNull()
    expect(first.etaDisplay).toEqual({
      kind: 'unavailable',
    })
    expect(first.etaMsOrNull).toBeNull()
    expect(first.activeIncidentCount).toBe(0)
    expect(first.affectedContainerCount).toBe(0)
    expect(first.recognizedIncidentCount).toBe(0)
    expect(first.dominantIncident).toBeNull()
    expect(first.lastEventAt).toBeNull()
    expect(first.syncStatus).toBe('idle')
    expect(first.lastSyncAt).toBeNull()
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

    const first = requireAt(result, 0)
    const second = requireAt(result, 1)
    const third = requireAt(result, 2)
    expect(first.syncStatus).toBe('syncing')
    expect(first.lastSyncAt).toBe('2026-03-05T10:00:00.000Z')
    expect(second.syncStatus).toBe('idle')
    expect(third.syncStatus).toBe('idle')
  })

  it('maps tracking validation summary into the dashboard VM without re-deriving it', () => {
    const result = toProcessSummaryVMs([
      makeSource({
        id: 'p-validation',
        tracking_validation: {
          has_issues: true,
          highest_severity: 'warning',
          affected_container_count: 2,
        },
      }),
    ])

    expect(result[0]?.trackingValidation).toEqual({
      hasIssues: true,
      highestSeverity: 'warning',
      affectedContainerCount: 2,
      topIssue: null,
    })
    expect(result[0]?.attentionSeverity).toBeNull()
  })

  it('maps backend-derived critical attention severity into the dashboard VM', () => {
    const result = toProcessSummaryVMs([
      makeSource({
        id: 'p-validation-critical',
        attention_severity: 'danger',
        tracking_validation: {
          has_issues: true,
          highest_severity: 'danger',
          affected_container_count: 2,
          top_issue: {
            code: 'CONFLICTING_CRITICAL_ACTUALS',
            severity: 'danger',
            reason_key: 'tracking.validation.conflictingCriticalActuals',
            affected_area: 'series',
            affected_location: 'BRSSZ',
            affected_block_label_key: null,
          },
        },
      }),
    ])

    expect(result[0]?.trackingValidation).toEqual({
      hasIssues: true,
      highestSeverity: 'danger',
      affectedContainerCount: 2,
      topIssue: {
        code: 'CONFLICTING_CRITICAL_ACTUALS',
        severity: 'danger',
        reasonKey: 'tracking.validation.conflictingCriticalActuals',
        affectedArea: 'series',
        affectedLocation: 'BRSSZ',
        affectedBlockLabelKey: null,
      },
    })
    expect(result[0]?.attentionSeverity).toBe('danger')
  })

  it('maps the new advisory top issue into the dashboard VM without re-deriving semantics', () => {
    const result = toProcessSummaryVMs([
      makeSource({
        id: 'p-validation-advisory',
        tracking_validation: {
          has_issues: true,
          highest_severity: 'warning',
          affected_container_count: 1,
          top_issue: {
            code: 'MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT',
            severity: 'warning',
            reason_key: 'tracking.validation.missingCriticalMilestoneWithContradictoryContext',
            affected_area: 'timeline',
            affected_location: 'BRSSZ',
            affected_block_label_key: null,
          },
        },
      }),
    ])

    expect(result[0]?.trackingValidation).toEqual({
      hasIssues: true,
      highestSeverity: 'warning',
      affectedContainerCount: 1,
      topIssue: {
        code: 'MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT',
        severity: 'warning',
        reasonKey: 'tracking.validation.missingCriticalMilestoneWithContradictoryContext',
        affectedArea: 'timeline',
        affectedLocation: 'BRSSZ',
        affectedBlockLabelKey: null,
      },
    })
    expect(result[0]?.attentionSeverity).toBeNull()
  })

  it('falls back to dominant incident severity when attention_severity is absent', () => {
    const result = toProcessSummaryVMs([
      makeSource({
        id: 'p-legacy-alert-severity',
        operational_incidents: {
          summary: {
            active_incidents: 1,
            affected_containers: 1,
            recognized_incidents: 0,
          },
          dominant: {
            type: 'ETA_PASSED',
            severity: 'warning',
            fact: {
              message_key: 'incidents.fact.etaPassed',
              message_params: {},
            },
            triggered_at: '2025-04-29T08:00:00Z',
          },
        },
      }),
    ])

    expect(result[0]?.attentionSeverity).toBe('warning')
  })
})

describe('toProcessSummaryVMs presentation details', () => {
  it('maps DELIVERED status correctly', () => {
    const result = toProcessSummaryVMs([makeSource({ id: 'p4', process_status: 'DELIVERED' })])
    const first = requireAt(result, 0)
    expect(first.status).toBe('green-600')
    expect(first.statusCode).toBe('DELIVERED')
    expect(first.statusRank).toBeGreaterThan(0)
  })

  it('maps process-only meta statuses', () => {
    const result = toProcessSummaryVMs([
      makeSource({ id: 'p-booked', process_status: 'BOOKED' }),
      makeSource({ id: 'p-awaiting', process_status: 'AWAITING_DATA' }),
      makeSource({ id: 'p-sync', process_status: 'NOT_SYNCED' }),
    ])

    const first = requireAt(result, 0)
    const second = requireAt(result, 1)
    const third = requireAt(result, 2)
    expect(first.status).toBe('slate-400')
    expect(first.statusCode).toBe('BOOKED')
    expect(second.status).toBe('amber-600')
    expect(second.statusCode).toBe('AWAITING_DATA')
    expect(third.status).toBe('amber-700')
    expect(third.statusCode).toBe('NOT_SYNCED')
  })

  it('drops microbadge when API status is not operationally meaningful', () => {
    const result = toProcessSummaryVMs([
      makeSource({
        id: 'p-micro-invalid',
        process_status: 'IN_TRANSIT',
        status_microbadge: {
          status: 'IN_TRANSIT',
          count: 3,
        },
      }),
    ])

    expect(requireAt(result, 0).statusMicrobadge).toBeNull()
  })

  it('maps date-only eta to a UTC start-of-day comparable timestamp', () => {
    const result = toProcessSummaryVMs([
      makeSource({
        id: 'p7',
        eta: temporalDtoFromCanonical('2025-06-01'),
      }),
    ])
    const first = requireAt(result, 0)
    expect(first.eta).toEqual(temporalDtoFromCanonical('2025-06-01'))
    expect(first.etaDisplay).toEqual({
      kind: 'date',
      value: temporalDtoFromCanonical('2025-06-01'),
    })
    expect(first.etaMsOrNull).toBe(Instant.fromIso('2025-06-01T00:00:00.000Z').toEpochMs())
  })

  it('maps delivered eta_display without changing null ETA sort value', () => {
    const result = toProcessSummaryVMs([
      makeSource({
        id: 'p-delivered',
        process_status: 'DELIVERED',
        eta: null,
        eta_display: {
          kind: 'delivered',
        },
      }),
    ])

    const first = requireAt(result, 0)
    expect(first.eta).toBeNull()
    expect(first.etaDisplay).toEqual({
      kind: 'delivered',
    })
    expect(first.etaMsOrNull).toBeNull()
  })

  it('maps arrived eta_display and keeps the arrival date sortable', () => {
    const arrivedEta = temporalDtoFromCanonical('2026-03-28T12:00:00.000Z')

    const result = toProcessSummaryVMs([
      makeSource({
        id: 'p-arrived',
        eta: null,
        eta_display: {
          kind: 'arrived',
          value: arrivedEta,
        },
      }),
    ])

    const first = requireAt(result, 0)
    expect(first.eta).toBeNull()
    expect(first.etaDisplay).toEqual({
      kind: 'arrived',
      value: arrivedEta,
    })
    expect(first.etaMsOrNull).toBe(Date.parse('2026-03-28T12:00:00.000Z'))
  })

  it('falls back to legacy eta when eta_display is absent', () => {
    const eta = temporalDtoFromCanonical('2025-06-01T00:00:00Z')

    const result = toProcessSummaryVMs([
      makeSource({
        id: 'p-legacy-eta',
        eta,
      }),
    ])

    expect(requireAt(result, 0).etaDisplay).toEqual({
      kind: 'date',
      value: eta,
    })
  })

  it('normalizes blank importer_name to null', () => {
    const result = toProcessSummaryVMs([makeSource({ id: 'p5', importer_name: '   ' })])
    const first = requireAt(result, 0)
    expect(first.importerId).toBeNull()
    expect(first.importerName).toBeNull()
  })

  it('trims leading/trailing whitespace in non-blank importer_name', () => {
    const result = toProcessSummaryVMs([makeSource({ id: 'p6', importer_name: '  Empresa ABC  ' })])
    expect(requireAt(result, 0).importerName).toBe('Empresa ABC')
  })

  it('maps redestination_number to redestinationNumber', () => {
    const result = toProcessSummaryVMs([
      makeSource({ id: 'p-redest', redestination_number: 'RD-12345' }),
    ])
    expect(requireAt(result, 0).redestinationNumber).toBe('RD-12345')
  })

  it('defaults redestinationNumber to null when absent', () => {
    const result = toProcessSummaryVMs([makeSource({ id: 'p-no-redest' })])
    expect(requireAt(result, 0).redestinationNumber).toBeNull()
  })

  it('normalizes null redestination_number to null', () => {
    const result = toProcessSummaryVMs([
      makeSource({ id: 'p-null-redest', redestination_number: null }),
    ])
    expect(requireAt(result, 0).redestinationNumber).toBeNull()
  })

  it('normalizes empty redestination_number to null', () => {
    const result = toProcessSummaryVMs([
      makeSource({ id: 'p-empty-redest', redestination_number: '' }),
    ])
    expect(requireAt(result, 0).redestinationNumber).toBeNull()
  })

  it('normalizes whitespace-only redestination_number to null', () => {
    const result = toProcessSummaryVMs([
      makeSource({ id: 'p-blank-redest', redestination_number: '   ' }),
    ])
    expect(requireAt(result, 0).redestinationNumber).toBeNull()
  })
})
