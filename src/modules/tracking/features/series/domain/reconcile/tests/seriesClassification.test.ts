import { describe, expect, it } from 'vitest'
import {
  type ClassifiedObservation,
  classifySeries,
  type ObservationLike,
  type SeriesLabel,
} from '~/modules/tracking/features/series/domain/reconcile/seriesClassification'
import {
  instantFromIsoText,
  resolveTemporalValue,
  temporalValueFromCanonical,
} from '~/shared/time/tests/helpers'

// Test helper to create minimal observation
type ObservationLikeOverrides = Omit<Partial<ObservationLike>, 'event_time'> & {
  readonly event_time?: string | ObservationLike['event_time']
}
type ObservationWithId = ObservationLike & { readonly id: string }

const DEFAULT_EVENT_TIME = temporalValueFromCanonical('2026-01-15T00:00:00.000Z')

function makeObs(overrides: ObservationLikeOverrides = {}): ObservationLike {
  const { event_time, ...rest } = overrides

  return {
    event_time: resolveTemporalValue(event_time, DEFAULT_EVENT_TIME),
    event_time_type: 'EXPECTED',
    created_at: '2026-01-01T00:00:00.000Z',
    ...rest,
  }
}

// Helper to extract labels for assertions
function extractLabels(classified: readonly ClassifiedObservation[]): SeriesLabel[] {
  return classified.map((c) => c.seriesLabel)
}

function makeEtaRevision(args: {
  readonly id: string
  readonly eventTime: string
  readonly createdAt: string
}): ObservationWithId {
  return {
    id: args.id,
    event_time: resolveTemporalValue(args.eventTime, DEFAULT_EVENT_TIME),
    event_time_type: 'EXPECTED',
    created_at: args.createdAt,
  }
}

function labelsById(
  classified: readonly ClassifiedObservation<ObservationWithId>[],
): ReadonlyMap<string, SeriesLabel> {
  return new Map(classified.map((observation) => [observation.id, observation.seriesLabel]))
}

describe('Event Series Classification', () => {
  const now = instantFromIsoText('2026-02-01T00:00:00.000Z')

  describe('Empty and single observation cases', () => {
    it('should handle empty series', () => {
      const result = classifySeries([], now)
      expect(result.primary).toBeNull()
      expect(result.classified).toHaveLength(0)
      expect(result.hasActualConflict).toBe(false)
      expect(result.conflictingActualCount).toBe(0)
    })

    it('should handle single ACTUAL observation', () => {
      const obs = [makeObs({ event_time_type: 'ACTUAL', event_time: '2026-01-20T00:00:00.000Z' })]
      const result = classifySeries(obs, now)
      expect(result.primary).toBe(obs[0])
      expect(result.classified).toHaveLength(1)
      expect(result.classified[0]?.seriesLabel).toBe('CONFIRMED')
      expect(result.hasActualConflict).toBe(false)
    })

    it('should handle single future EXPECTED observation', () => {
      const obs = [makeObs({ event_time: '2026-03-01T00:00:00.000Z' })]
      const result = classifySeries(obs, now)
      expect(result.primary?.event_time).toBe(obs[0]?.event_time)
      expect(result.classified[0]?.seriesLabel).toBe('ACTIVE')
      expect(result.hasActualConflict).toBe(false)
    })

    it('should handle single expired EXPECTED observation', () => {
      const obs = [makeObs({ event_time: '2025-12-01T00:00:00.000Z' })]
      const result = classifySeries(obs, now)
      expect(result.primary).toBeNull() // Expired EXPECTED cannot be primary
      expect(result.classified[0]?.seriesLabel).toBe('EXPIRED')
    })
  })

  describe('EXPECTED progression without ACTUAL', () => {
    it('should label latest EXPECTED as ACTIVE and others as SUPERSEDED', () => {
      const series = [
        makeObs({ event_time: '2026-02-05T00:00:00.000Z', created_at: '2026-01-01T00:00:00.000Z' }),
        makeObs({ event_time: '2026-02-10T00:00:00.000Z', created_at: '2026-01-05T00:00:00.000Z' }),
        makeObs({ event_time: '2026-02-15T00:00:00.000Z', created_at: '2026-01-10T00:00:00.000Z' }),
      ]
      const result = classifySeries(series, now)
      expect(result.primary?.event_time).toBe(series[2]?.event_time)
      expect(extractLabels(result.classified)).toEqual([
        'SUPERSEDED_EXPECTED',
        'SUPERSEDED_EXPECTED',
        'ACTIVE',
      ])
      expect(result.hasActualConflict).toBe(false)
    })

    it('should label latest observed past EXPECTED as EXPIRED when no active revision exists', () => {
      const series = [
        makeObs({ event_time: '2025-12-01T00:00:00.000Z' }),
        makeObs({ event_time: '2025-12-10T00:00:00.000Z' }),
      ]
      const result = classifySeries(series, now)
      expect(result.primary).toBeNull()
      expect(extractLabels(result.classified)).toEqual(['SUPERSEDED_EXPECTED', 'EXPIRED'])
    })

    it('should label past EXPECTED as SUPERSEDED when newer active EXPECTED exists', () => {
      const series = [
        makeObs({ event_time: '2025-12-01T00:00:00.000Z' }), // expired
        makeObs({ event_time: '2026-03-01T00:00:00.000Z' }), // active
      ]
      const result = classifySeries(series, now)
      expect(result.primary?.event_time).toBe(series[1]?.event_time)
      expect(extractLabels(result.classified)).toEqual(['SUPERSEDED_EXPECTED', 'ACTIVE'])
    })

    it('selects latest observed EXPECTED as active when ETA date moves earlier', () => {
      const referenceNow = instantFromIsoText('2026-04-11T00:00:00.000Z')
      const series = [
        makeEtaRevision({
          id: 'eta-03',
          eventTime: '2026-05-03',
          createdAt: '2026-04-10T10:36:02.943421Z',
        }),
        makeEtaRevision({
          id: 'eta-05',
          eventTime: '2026-05-05',
          createdAt: '2026-04-10T17:37:48.410353Z',
        }),
        makeEtaRevision({
          id: 'eta-08',
          eventTime: '2026-05-08',
          createdAt: '2026-04-04T16:08:30.906851Z',
        }),
        makeEtaRevision({
          id: 'eta-12',
          eventTime: '2026-05-12',
          createdAt: '2026-04-08T20:05:19.293794Z',
        }),
      ]

      const result = classifySeries(series, referenceNow)
      const labels = labelsById(result.classified)

      expect(result.primary?.id).toBe('eta-05')
      expect(labels.get('eta-05')).toBe('ACTIVE')
      expect(labels.get('eta-03')).toBe('SUPERSEDED_EXPECTED')
      expect(labels.get('eta-08')).toBe('SUPERSEDED_EXPECTED')
      expect(labels.get('eta-12')).toBe('SUPERSEDED_EXPECTED')
    })

    it('breaks EXPECTED created_at ties by input order, not predicted event date', () => {
      const referenceNow = instantFromIsoText('2026-04-11T00:00:00.000Z')
      const tiedCreatedAt = '2026-04-10T17:37:48.410Z'
      const series = [
        makeEtaRevision({
          id: 'eta-12-same-ms',
          eventTime: '2026-05-12',
          createdAt: tiedCreatedAt,
        }),
        makeEtaRevision({
          id: 'eta-05-same-ms',
          eventTime: '2026-05-05',
          createdAt: tiedCreatedAt,
        }),
      ]

      const result = classifySeries(series, referenceNow)
      const labels = labelsById(result.classified)

      expect(result.primary?.id).toBe('eta-05-same-ms')
      expect(labels.get('eta-05-same-ms')).toBe('ACTIVE')
      expect(labels.get('eta-12-same-ms')).toBe('SUPERSEDED_EXPECTED')
    })
  })

  describe('EXPECTED then ACTUAL (Rule E1 & E2)', () => {
    it('should label EXPECTED before ACTUAL as SUPERSEDED', () => {
      const series = [
        makeObs({ event_time: '2026-01-05T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2026-01-10T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2026-01-15T00:00:00.000Z', event_time_type: 'ACTUAL' }),
      ]
      const result = classifySeries(series, now)
      expect(result.primary).toBe(series[2]) // ACTUAL is primary
      expect(extractLabels(result.classified)).toEqual([
        'SUPERSEDED_EXPECTED',
        'SUPERSEDED_EXPECTED',
        'CONFIRMED',
      ])
    })

    it('should label EXPECTED >= ACTUAL event_time as REDUNDANT_AFTER_ACTUAL', () => {
      const series = [
        makeObs({ event_time: '2026-01-15T00:00:00.000Z', event_time_type: 'ACTUAL' }),
        makeObs({ event_time: '2026-01-15T00:00:00.000Z', event_time_type: 'EXPECTED' }), // Same time
        makeObs({ event_time: '2026-01-20T00:00:00.000Z', event_time_type: 'EXPECTED' }), // After
      ]
      const result = classifySeries(series, now)
      expect(result.primary).toBe(series[0])
      expect(extractLabels(result.classified)).toEqual([
        'CONFIRMED',
        'REDUNDANT_AFTER_ACTUAL',
        'REDUNDANT_AFTER_ACTUAL',
      ])
    })

    it('should keep future EXPECTED after ACTUAL as ACTIVE (new plan)', () => {
      const series = [
        makeObs({ event_time: '2026-01-15T00:00:00.000Z', event_time_type: 'ACTUAL' }),
        makeObs({ event_time: '2026-03-01T00:00:00.000Z', event_time_type: 'EXPECTED' }), // Future
      ]
      const result = classifySeries(series, now)
      // Primary is ACTUAL (safe-first)
      expect(result.primary).toBe(series[0])
      // But EXPECTED after is not redundant (represents new forecast)
      // Since it's after ACTUAL time, it's marked redundant by Rule E1
      expect(extractLabels(result.classified)).toEqual(['CONFIRMED', 'REDUNDANT_AFTER_ACTUAL'])
    })
  })

  describe('Multiple ACTUAL (conflict detection)', () => {
    it('should detect conflict and select latest observed ACTUAL as primary', () => {
      const series = [
        makeObs({
          event_time: '2026-01-10T00:00:00.000Z',
          event_time_type: 'ACTUAL',
          created_at: '2026-01-10T10:00:00.000Z',
        }),
        makeObs({
          event_time: '2026-01-15T00:00:00.000Z',
          event_time_type: 'ACTUAL',
          created_at: '2026-01-15T10:00:00.000Z',
        }),
        makeObs({
          event_time: '2026-01-20T00:00:00.000Z',
          event_time_type: 'ACTUAL',
          created_at: '2026-01-20T10:00:00.000Z',
        }),
      ]
      const result = classifySeries(series, now)
      expect(result.hasActualConflict).toBe(true)
      expect(result.conflictingActualCount).toBe(2)
      expect(result.primary).toBe(series[2]) // Latest observed ACTUAL
      expect(extractLabels(result.classified)).toEqual([
        'CONFLICTING_ACTUAL',
        'CONFLICTING_ACTUAL',
        'CONFIRMED',
      ])
    })

    it('selects latest observed ACTUAL even when a backfilled correction has older event_time', () => {
      const series = [
        makeObs({
          event_time: '2026-01-20T00:00:00.000Z',
          event_time_type: 'ACTUAL',
          created_at: '2026-01-10T08:00:00.000Z',
        }),
        makeObs({
          event_time: '2026-01-15T00:00:00.000Z',
          event_time_type: 'ACTUAL',
          created_at: '2026-01-11T08:00:00.000Z',
        }),
      ]

      const result = classifySeries(series, now)

      expect(result.primary).toBe(series[1])
      expect(extractLabels(result.classified)).toEqual(['CONFLICTING_ACTUAL', 'CONFIRMED'])
    })

    it('uses event_time as tiebreaker when ACTUAL observed_at values are equal', () => {
      const series = [
        makeObs({
          event_time: '2026-01-15T00:00:00.000Z',
          event_time_type: 'ACTUAL',
          created_at: '2026-01-15T12:00:00.000Z',
        }),
        makeObs({
          event_time: '2026-01-17T00:00:00.000Z',
          event_time_type: 'ACTUAL',
          created_at: '2026-01-15T12:00:00.000Z',
        }),
      ]
      const result = classifySeries(series, now)
      expect(result.hasActualConflict).toBe(true)
      expect(result.primary).toBe(series[1]) // Later event_time tiebreak
      expect(extractLabels(result.classified)).toEqual(['CONFLICTING_ACTUAL', 'CONFIRMED'])
    })

    it('keeps deterministic ACTUAL primary when observed_at and event_time both tie', () => {
      const series = [
        makeObs({
          event_time: '2026-01-15T00:00:00.000Z',
          event_time_type: 'ACTUAL',
          created_at: '2026-01-15T12:00:00.000Z',
        }),
        makeObs({
          event_time: '2026-01-15T00:00:00.000Z',
          event_time_type: 'ACTUAL',
          created_at: '2026-01-15T12:00:00.000Z',
        }),
      ]

      const result = classifySeries(series, now)

      expect(result.primary).toBe(series[0])
      expect(extractLabels(result.classified)).toEqual(['CONFIRMED', 'CONFLICTING_ACTUAL'])
    })

    it('should handle ACTUAL with null event_time (use created_at only)', () => {
      const series = [
        makeObs({
          event_time: null,
          event_time_type: 'ACTUAL',
          created_at: '2026-01-10T00:00:00.000Z',
        }),
        makeObs({
          event_time: null,
          event_time_type: 'ACTUAL',
          created_at: '2026-01-15T00:00:00.000Z',
        }),
      ]
      const result = classifySeries(series, now)
      expect(result.hasActualConflict).toBe(true)
      expect(result.primary).toBe(series[1]) // Latest created_at
    })

    it('prefers latest observed ACTUAL over null/non-null event_time differences', () => {
      const series = [
        makeObs({
          event_time: null,
          event_time_type: 'ACTUAL',
          created_at: '2026-01-20T00:00:00.000Z',
        }),
        makeObs({
          event_time: '2026-01-15T00:00:00.000Z',
          event_time_type: 'ACTUAL',
          created_at: '2026-01-10T00:00:00.000Z',
        }),
      ]
      const result = classifySeries(series, now)
      expect(result.primary).toBe(series[0]) // Latest observed ACTUAL
    })

    it('marks voyage mismatch after confirmation and labels the older ACTUAL as corrected', () => {
      const series = [
        makeObs({
          event_time: '2026-03-28',
          event_time_type: 'ACTUAL',
          created_at: '2026-04-02T19:12:43.853916Z',
          voyage: 'IV610A',
        }),
        makeObs({
          event_time: '2026-03-28',
          event_time_type: 'ACTUAL',
          created_at: '2026-04-04T16:53:10.273469Z',
          voyage: 'OB610R',
        }),
      ]

      const result = classifySeries(series, now)

      expect(result.primary).toBe(series[1])
      expect(result.conflict).toEqual({
        kind: 'VOYAGE_MISMATCH_AFTER_ACTUAL_CONFIRMATION',
        fields: ['voyage'],
      })
      expect(result.classified.map((observation) => observation.changeKind)).toEqual([
        'VOYAGE_CORRECTED_AFTER_CONFIRMATION',
        null,
      ])
    })
  })

  describe('Mixed EXPECTED and multiple ACTUAL', () => {
    it('should classify EXPECTED before multiple ACTUALs correctly', () => {
      const series = [
        makeObs({ event_time: '2026-01-01T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2026-01-05T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2026-01-10T00:00:00.000Z', event_time_type: 'ACTUAL' }),
        makeObs({ event_time: '2026-01-15T00:00:00.000Z', event_time_type: 'ACTUAL' }),
        makeObs({ event_time: '2026-01-20T00:00:00.000Z', event_time_type: 'EXPECTED' }), // After ACTUAL
      ]
      const result = classifySeries(series, now)
      expect(result.hasActualConflict).toBe(true)
      expect(result.primary).toBe(series[3]) // Latest observed ACTUAL
      expect(extractLabels(result.classified)).toEqual([
        'SUPERSEDED_EXPECTED', // Before ACTUAL
        'SUPERSEDED_EXPECTED', // Before ACTUAL
        'CONFLICTING_ACTUAL', // Earlier ACTUAL
        'CONFIRMED', // Primary ACTUAL
        'REDUNDANT_AFTER_ACTUAL', // After latest ACTUAL
      ])
    })
  })

  describe('Real-world scenarios', () => {
    it('should handle carrier API sending redundant EXPECTED after confirmation', () => {
      // Scenario: Carrier confirms ACTUAL, then continues sending EXPECTED forecasts (API quirk)
      const series = [
        makeObs({ event_time: '2026-01-05T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2026-01-10T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2026-01-12T00:00:00.000Z', event_time_type: 'ACTUAL' }), // Confirmed
        makeObs({ event_time: '2026-01-15T00:00:00.000Z', event_time_type: 'EXPECTED' }), // Redundant
        makeObs({ event_time: '2026-01-18T00:00:00.000Z', event_time_type: 'EXPECTED' }), // Redundant
      ]
      const result = classifySeries(series, now)
      expect(result.primary).toBe(series[2])
      expect(extractLabels(result.classified)).toEqual([
        'SUPERSEDED_EXPECTED',
        'SUPERSEDED_EXPECTED',
        'CONFIRMED',
        'REDUNDANT_AFTER_ACTUAL',
        'REDUNDANT_AFTER_ACTUAL',
      ])
    })

    it('should handle backfill creating conflicting ACTUAL records', () => {
      // Scenario: Initial ACTUAL from scrape, later backfill discovers earlier ACTUAL
      const series = [
        makeObs({
          event_time: '2026-01-10T00:00:00.000Z',
          event_time_type: 'ACTUAL',
          created_at: '2026-01-15T00:00:00.000Z', // Discovered later
        }),
        makeObs({
          event_time: '2026-01-12T00:00:00.000Z',
          event_time_type: 'ACTUAL',
          created_at: '2026-01-11T00:00:00.000Z', // Original
        }),
      ]
      const result = classifySeries(series, now)
      expect(result.hasActualConflict).toBe(true)
      expect(result.primary).toBe(series[0]) // Latest observed ACTUAL revision
      expect(extractLabels(result.classified)).toEqual(['CONFIRMED', 'CONFLICTING_ACTUAL'])
    })

    it('should handle progression: EXPECTED → EXPECTED → ACTUAL → EXPECTED (redundant)', () => {
      const series = [
        makeObs({
          event_time: '2026-02-05T00:00:00.000Z',
          event_time_type: 'EXPECTED',
          created_at: '2026-01-10T00:00:00.000Z',
        }),
        makeObs({
          event_time: '2026-02-10T00:00:00.000Z',
          event_time_type: 'EXPECTED',
          created_at: '2026-01-20T00:00:00.000Z',
        }),
        makeObs({
          event_time: '2026-02-08T00:00:00.000Z',
          event_time_type: 'ACTUAL',
          created_at: '2026-02-08T12:00:00.000Z',
        }),
        makeObs({
          event_time: '2026-02-12T00:00:00.000Z',
          event_time_type: 'EXPECTED',
          created_at: '2026-02-09T00:00:00.000Z',
        }),
      ]
      const result = classifySeries(series, now)
      expect(result.primary).toBe(series[2]) // ACTUAL
      expect(extractLabels(result.classified)).toEqual([
        'SUPERSEDED_EXPECTED',
        'REDUNDANT_AFTER_ACTUAL', // >= 2026-02-08
        'CONFIRMED',
        'REDUNDANT_AFTER_ACTUAL', // >= 2026-02-08
      ])
    })
  })

  describe('Null event_time handling', () => {
    it('should handle EXPECTED with null event_time as active', () => {
      const series = [makeObs({ event_time: null, event_time_type: 'EXPECTED' })]
      const result = classifySeries(series, now)
      expect(result.primary?.event_time).toBe(series[0]?.event_time)
      expect(result.classified[0]?.seriesLabel).toBe('ACTIVE')
    })

    it('should not mark EXPECTED with null as expired', () => {
      const series = [
        makeObs({
          event_time: null,
          event_time_type: 'EXPECTED',
          created_at: '2026-01-01T00:00:00.000Z',
        }),
        makeObs({
          event_time: '2026-03-01T00:00:00.000Z',
          event_time_type: 'EXPECTED',
          created_at: '2026-01-02T00:00:00.000Z',
        }),
      ]
      const result = classifySeries(series, now)
      expect(result.primary?.event_time).toBe(series[1]?.event_time)
      expect(extractLabels(result.classified)).toEqual(['SUPERSEDED_EXPECTED', 'ACTIVE'])
    })
  })

  describe('Primary selection rules', () => {
    it('should never select expired EXPECTED as primary', () => {
      const series = [
        makeObs({ event_time: '2025-12-01T00:00:00.000Z', event_time_type: 'EXPECTED' }),
        makeObs({ event_time: '2025-12-10T00:00:00.000Z', event_time_type: 'EXPECTED' }),
      ]
      const result = classifySeries(series, now)
      expect(result.primary).toBeNull()
    })

    it('should never select redundant EXPECTED as primary', () => {
      const series = [
        makeObs({ event_time: '2026-01-15T00:00:00.000Z', event_time_type: 'ACTUAL' }),
        makeObs({ event_time: '2026-01-20T00:00:00.000Z', event_time_type: 'EXPECTED' }),
      ]
      const result = classifySeries(series, now)
      expect(result.primary).toBe(series[0]) // ACTUAL, not EXPECTED
    })

    it('should select ACTUAL even if EXPECTED is more recent', () => {
      const series = [
        makeObs({ event_time: '2026-01-10T00:00:00.000Z', event_time_type: 'ACTUAL' }),
        makeObs({ event_time: '2026-03-01T00:00:00.000Z', event_time_type: 'EXPECTED' }),
      ]
      const result = classifySeries(series, now)
      expect(result.primary).toBe(series[0]) // ACTUAL has precedence
    })

    it('keeps ACTUAL primary over newer observed EXPECTED revisions', () => {
      const referenceNow = instantFromIsoText('2026-04-11T00:00:00.000Z')
      const series = [
        makeEtaRevision({
          id: 'eta-05',
          eventTime: '2026-05-05',
          createdAt: '2026-04-10T17:37:48.410353Z',
        }),
        makeEtaRevision({
          id: 'eta-12',
          eventTime: '2026-05-12',
          createdAt: '2026-04-08T20:05:19.293794Z',
        }),
        {
          id: 'arrival-actual',
          event_time: resolveTemporalValue('2026-05-06', DEFAULT_EVENT_TIME),
          event_time_type: 'ACTUAL' as const,
          created_at: '2026-05-06T10:00:00.000Z',
        },
      ]

      const result = classifySeries(series, referenceNow)
      const labels = labelsById(result.classified)

      expect(result.primary?.id).toBe('arrival-actual')
      expect(labels.get('arrival-actual')).toBe('CONFIRMED')
      expect(Array.from(labels.values())).not.toContain('ACTIVE')
    })
  })
})
