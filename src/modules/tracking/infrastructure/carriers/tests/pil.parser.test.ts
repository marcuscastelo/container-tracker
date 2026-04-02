import { describe, expect, it } from 'vitest'
import { parsePilTrackingPayload } from '~/modules/tracking/infrastructure/carriers/normalizers/pil.parser'
import {
  PIL_MISSING_TABLE_PAYLOAD,
  PIL_SAMPLE_CONTAINER_NUMBER,
  PIL_VALID_PAYLOAD,
} from '~/modules/tracking/infrastructure/carriers/tests/helpers/pil.fixture'

describe('parsePilTrackingPayload', () => {
  it('parses summary and detailed rows with ACTUAL and EXPECTED timestamps', () => {
    const result = parsePilTrackingPayload(PIL_VALID_PAYLOAD)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.containerNumber).toBe(PIL_SAMPLE_CONTAINER_NUMBER)
    expect(result.value.summary).toEqual({
      rawLoadPortName: 'QINGDAO',
      rawLoadPortCode: 'CNTAO',
      rawNextLocationCode: 'BRSSZ',
      rawNextLocationDateText: '23-Apr-2026',
      rawVessel: 'CMA CGM KRYPTON',
      rawVoyage: 'VCGK0001W',
    })
    expect(result.value.detailedEvents).toHaveLength(6)

    const gateOut = result.value.detailedEvents[0]
    expect(gateOut?.rawEventName).toBe('O/B Empty Container Released')
    expect(gateOut?.eventTimeType).toBe('ACTUAL')
    expect(gateOut?.eventDate).toBeNull()
    expect(gateOut?.eventLocalDateTime).toBe('2026-03-02T14:04:00.000')

    const discharge = result.value.detailedEvents[3]
    expect(discharge?.rawEventName).toBe('Vessel Discharge')
    expect(discharge?.eventTimeType).toBe('EXPECTED')
    expect(discharge?.eventDate).toBeNull()
    expect(discharge?.eventLocalDateTime).toBe('2026-04-23T19:00:00.000')

    const unavailable = result.value.detailedEvents[4]
    expect(unavailable?.rawEventName).toBe('Truck Gate Out from I/B Terminal')
    expect(unavailable?.eventDate).toBeNull()
    expect(unavailable?.eventLocalDateTime).toBeNull()
    expect(unavailable?.eventTimeType).toBeNull()
  })

  it('returns a fatal parse error when the detailed event table is missing', () => {
    const result = parsePilTrackingPayload(PIL_MISSING_TABLE_PAYLOAD)

    expect(result).toEqual({
      ok: false,
      error: 'PIL payload missing detailed event table',
    })
  })
})
