import { describe, expect, it } from 'vitest'
import { resolveOneEventTemporal } from '~/modules/tracking/infrastructure/carriers/normalizers/one.temporal'
import { temporalCanonicalText } from '~/shared/time/tests/helpers'

describe('ONE temporal normalization', () => {
  it.each([
    {
      locationCode: 'PKLHE',
      locationDisplay: 'LAHORE, PAKISTAN',
      eventLocalPortDate: '2026-02-16T22:26:00.000Z',
      eventDate: '2026-02-16T17:26:00.000Z',
      expected: '2026-02-16T22:26:00.000[Asia/Karachi]',
    },
    {
      locationCode: 'PKKHI',
      locationDisplay: 'KARACHI, PAKISTAN',
      eventLocalPortDate: '2026-02-27T04:27:00.000Z',
      eventDate: '2026-02-26T23:27:00.000Z',
      expected: '2026-02-27T04:27:00.000[Asia/Karachi]',
    },
    {
      locationCode: 'SGSIN',
      locationDisplay: 'SINGAPORE, SINGAPORE',
      eventLocalPortDate: '2026-03-11T20:25:00.000Z',
      eventDate: '2026-03-11T12:25:00.000Z',
      expected: '2026-03-11T20:25:00.000[Asia/Singapore]',
    },
    {
      locationCode: 'BRSSZ',
      locationDisplay: 'SANTOS, BRAZIL',
      eventLocalPortDate: '2026-04-14T01:00:00.000Z',
      eventDate: '2026-04-14T04:00:00.000Z',
      expected: '2026-04-14T01:00:00.000[America/Sao_Paulo]',
    },
  ])('uses serialized local-port datetimes for $locationCode', (fixture) => {
    const temporal = resolveOneEventTemporal(fixture)

    expect(temporalCanonicalText(temporal.event_time)).toBe(fixture.expected)
    expect(temporal.event_time_source).toBe('carrier_local_port_time')
  })

  it('falls back to the absolute eventDate when the port timezone is unknown', () => {
    const temporal = resolveOneEventTemporal({
      locationCode: null,
      locationDisplay: 'Unknown Port',
      eventLocalPortDate: '2026-04-14T01:00:00.000Z',
      eventDate: '2026-04-14T04:00:00.000Z',
    })

    expect(temporalCanonicalText(temporal.event_time)).toBe('2026-04-14T04:00:00.000Z')
    expect(temporal.event_time_source).toBe('carrier_explicit_timezone')
  })
})
