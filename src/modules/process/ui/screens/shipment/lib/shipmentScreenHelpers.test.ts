import { describe, expect, it } from 'vitest'
import {
  toSortedActiveAlerts,
  toSortedArchivedAlerts,
} from '~/modules/process/ui/screens/shipment/lib/shipmentAlerts.sorting'
import {
  toCreateErrorExisting,
  toCreateErrorMessage,
} from '~/modules/process/ui/screens/shipment/lib/shipmentEdit.mapper'
import {
  readErrorFromJsonBody,
  toReadableErrorMessage,
} from '~/modules/process/ui/screens/shipment/lib/shipmentError.presenter'
import { buildRecentUpdateHint } from '~/modules/process/ui/screens/shipment/lib/shipmentRefresh.helpers'
import type { ExistingProcessConflict } from '~/modules/process/ui/validation/processConflict.validation'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeAlert(overrides: Partial<AlertDisplayVM> = {}): AlertDisplayVM {
  return {
    id: 'alert-1',
    type: 'delay',
    severity: 'warning',
    containerNumber: 'MRKU1234567',
    messageKey: 'alerts.noMovementDetected',
    messageParams: {},
    timestamp: '2026-01-01T00:00:00.000Z',
    triggeredAtIso: '2026-01-01T00:00:00.000Z',
    ackedAtIso: null,
    category: 'monitoring',
    retroactive: false,
    ...overrides,
  }
}

function makeConflict(overrides: Partial<ExistingProcessConflict> = {}): ExistingProcessConflict {
  return {
    message: 'Process already exists',
    processId: 'proc-999',
    ...overrides,
  }
}

// ── shipmentAlerts.sorting ────────────────────────────────────────────────────

describe('toSortedActiveAlerts', () => {
  it('returns only unacked alerts', () => {
    const alerts = [
      makeAlert({ id: 'a', ackedAtIso: null }),
      makeAlert({ id: 'b', ackedAtIso: '2026-01-02T00:00:00.000Z' }),
      makeAlert({ id: 'c', ackedAtIso: null }),
    ]
    const result = toSortedActiveAlerts(alerts)
    // both share the same triggeredAtIso → id-descending tiebreaker: 'c' > 'a'
    expect(result.map((r) => r.id)).toEqual(['c', 'a'])
  })

  it('sorts active alerts by triggeredAtIso descending', () => {
    const alerts = [
      makeAlert({ id: 'older', triggeredAtIso: '2026-01-01T00:00:00.000Z' }),
      makeAlert({ id: 'newer', triggeredAtIso: '2026-01-03T00:00:00.000Z' }),
      makeAlert({ id: 'middle', triggeredAtIso: '2026-01-02T00:00:00.000Z' }),
    ]
    const result = toSortedActiveAlerts(alerts)
    expect(result.map((r) => r.id)).toEqual(['newer', 'middle', 'older'])
  })

  it('breaks triggeredAtIso ties by id descending', () => {
    const ts = '2026-01-01T00:00:00.000Z'
    const alerts = [
      makeAlert({ id: 'alpha', triggeredAtIso: ts }),
      makeAlert({ id: 'zeta', triggeredAtIso: ts }),
    ]
    const result = toSortedActiveAlerts(alerts)
    expect(result.map((r) => r.id)).toEqual(['zeta', 'alpha'])
  })

  it('returns empty array when all alerts are acked', () => {
    const alerts = [makeAlert({ ackedAtIso: '2026-01-01T10:00:00.000Z' })]
    expect(toSortedActiveAlerts(alerts)).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    expect(toSortedActiveAlerts([])).toEqual([])
  })

  it('does not mutate the input array', () => {
    const alerts = [
      makeAlert({ id: 'b', triggeredAtIso: '2026-01-02T00:00:00.000Z' }),
      makeAlert({ id: 'a', triggeredAtIso: '2026-01-01T00:00:00.000Z' }),
    ]
    const original = [...alerts]
    toSortedActiveAlerts(alerts)
    expect(alerts.map((a) => a.id)).toEqual(original.map((a) => a.id))
  })
})

describe('toSortedArchivedAlerts', () => {
  it('returns only acked alerts', () => {
    const alerts = [
      makeAlert({ id: 'a', ackedAtIso: '2026-01-01T00:00:00.000Z' }),
      makeAlert({ id: 'b', ackedAtIso: null }),
      makeAlert({ id: 'c', ackedAtIso: '2026-01-02T00:00:00.000Z' }),
    ]
    const result = toSortedArchivedAlerts(alerts)
    expect(result.map((r) => r.id)).toEqual(['c', 'a'])
  })

  it('sorts archived alerts by ackedAtIso descending', () => {
    const alerts = [
      makeAlert({ id: 'oldest', ackedAtIso: '2026-01-01T00:00:00.000Z' }),
      makeAlert({ id: 'newest', ackedAtIso: '2026-01-03T00:00:00.000Z' }),
      makeAlert({ id: 'mid', ackedAtIso: '2026-01-02T00:00:00.000Z' }),
    ]
    const result = toSortedArchivedAlerts(alerts)
    expect(result.map((r) => r.id)).toEqual(['newest', 'mid', 'oldest'])
  })

  it('breaks ackedAtIso ties by id descending', () => {
    const ts = '2026-01-01T00:00:00.000Z'
    const alerts = [
      makeAlert({ id: 'alpha', ackedAtIso: ts }),
      makeAlert({ id: 'zeta', ackedAtIso: ts }),
    ]
    const result = toSortedArchivedAlerts(alerts)
    expect(result.map((r) => r.id)).toEqual(['zeta', 'alpha'])
  })

  it('returns empty array for empty input', () => {
    expect(toSortedArchivedAlerts([])).toEqual([])
  })
})

// ── buildRecentUpdateHint ─────────────────────────────────────────────────────

describe('buildRecentUpdateHint', () => {
  const toSecondsLabel = (count: number) => `${count}s`
  const toMinutesLabel = (count: number) => `${count}m`

  it('uses seconds label for elapsed < 60 seconds', () => {
    const result = buildRecentUpdateHint({ elapsedMs: 30_000, toSecondsLabel, toMinutesLabel })
    expect(result).toBe('30s')
  })

  it('uses minutes label for elapsed >= 60 seconds', () => {
    const result = buildRecentUpdateHint({ elapsedMs: 120_000, toSecondsLabel, toMinutesLabel })
    expect(result).toBe('2m')
  })

  it('returns at least 1 second for sub-second elapsed', () => {
    const result = buildRecentUpdateHint({ elapsedMs: 500, toSecondsLabel, toMinutesLabel })
    expect(result).toBe('1s')
  })

  it('returns at least 1 minute for elapsed between 60 and 120 seconds', () => {
    const result = buildRecentUpdateHint({ elapsedMs: 61_000, toSecondsLabel, toMinutesLabel })
    expect(result).toBe('1m')
  })
})

// ── toReadableErrorMessage ────────────────────────────────────────────────────

describe('toReadableErrorMessage', () => {
  it('extracts nested "message" from JSON-like error strings', () => {
    const err = new Error('Request failed: {"message":"Container not found"}')
    expect(toReadableErrorMessage(err)).toBe('Container not found')
  })

  it('strips HTTP status code prefix', () => {
    const err = new Error('Error: 404 Not Found')
    expect(toReadableErrorMessage(err)).toBe('Not Found')
  })

  it('returns the message unchanged when no pattern matches', () => {
    const err = new Error('Something went wrong')
    expect(toReadableErrorMessage(err)).toBe('Something went wrong')
  })

  it('converts non-Error unknowns to string', () => {
    expect(toReadableErrorMessage('raw string error')).toBe('raw string error')
  })

  it('handles numeric non-Error values', () => {
    expect(toReadableErrorMessage(42)).toBe('42')
  })
})

// ── readErrorFromJsonBody ─────────────────────────────────────────────────────

describe('readErrorFromJsonBody', () => {
  it('returns the error string from a valid body', () => {
    expect(readErrorFromJsonBody({ error: 'Something failed' })).toBe('Something failed')
  })

  it('returns null when error field is absent', () => {
    expect(readErrorFromJsonBody({})).toBeNull()
  })

  it('returns null for non-object input', () => {
    expect(readErrorFromJsonBody('not an object')).toBeNull()
    expect(readErrorFromJsonBody(null)).toBeNull()
  })

  it('returns null when error is an empty/whitespace string', () => {
    expect(readErrorFromJsonBody({ error: '   ' })).toBeNull()
  })
})

// ── toCreateErrorMessage / toCreateErrorExisting ──────────────────────────────

describe('toCreateErrorMessage', () => {
  it('returns string value directly', () => {
    expect(toCreateErrorMessage('Validation error')).toBe('Validation error')
  })

  it('returns conflict.message for an ExistingProcessConflict', () => {
    const conflict = makeConflict({ message: 'Duplicate reference' })
    expect(toCreateErrorMessage(conflict)).toBe('Duplicate reference')
  })

  it('returns empty string for null', () => {
    expect(toCreateErrorMessage(null)).toBe('')
  })
})

describe('toCreateErrorExisting', () => {
  it('returns undefined for a string error', () => {
    expect(toCreateErrorExisting('plain error')).toBeUndefined()
  })

  it('returns the conflict object for an ExistingProcessConflict', () => {
    const conflict = makeConflict()
    expect(toCreateErrorExisting(conflict)).toBe(conflict)
  })

  it('returns undefined for null', () => {
    expect(toCreateErrorExisting(null)).toBeUndefined()
  })
})
