import { describe, expect, it } from 'vitest'
import { buildLocalDateTimeTrackingTemporal } from '~/modules/tracking/infrastructure/carriers/normalizers/tracking-temporal-resolution'
import { temporalCanonicalText } from '~/shared/time/tests/helpers'

describe('buildLocalDateTimeTrackingTemporal', () => {
  it('returns null temporal fields for malformed provider local datetime input', () => {
    const temporal = buildLocalDateTimeTrackingTemporal({
      localDateTime: 'invalid-local-datetime',
      rawEventTime: 'invalid-local-datetime',
      locationCode: 'BRSSZ',
      locationDisplay: 'SANTOS',
    })

    expect(temporal.event_time).toBeNull()
    expect(temporal.raw_event_time).toBe('invalid-local-datetime')
    expect(temporal.event_time_source).toBeNull()
  })

  it('falls back to date-only semantics without throwing when timezone is unknown', () => {
    const temporal = buildLocalDateTimeTrackingTemporal({
      localDateTime: '2026-04-24T19:00:00.000',
      rawEventTime: '2026-04-24 19:00:00',
      locationCode: null,
      locationDisplay: 'Unknown Port',
    })

    expect(temporalCanonicalText(temporal.event_time)).toBe('2026-04-24')
    expect(temporal.raw_event_time).toBe('2026-04-24 19:00:00')
    expect(temporal.event_time_source).toBe('derived_fallback')
  })
})
