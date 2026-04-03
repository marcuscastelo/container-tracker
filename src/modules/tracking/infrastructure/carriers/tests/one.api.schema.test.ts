import { describe, expect, it } from 'vitest'
import {
  OneCopEventsResponseSchema,
  OneSearchResponseSchema,
  OneVoyageListResponseSchema,
} from '~/modules/tracking/infrastructure/carriers/schemas/api/one.api.schema'
import {
  ONE_COP_EVENTS_FIXTURE,
  ONE_SEARCH_FIXTURE,
  ONE_VOYAGE_LIST_FIXTURE,
} from '~/modules/tracking/infrastructure/carriers/tests/helpers/one.fixture'

describe('ONE api schemas', () => {
  it('parses the real search fixture', () => {
    const parsed = OneSearchResponseSchema.parse(ONE_SEARCH_FIXTURE)

    expect(parsed.status).toBe(200)
    expect(parsed.code).toBe(1)
    expect(parsed.data).toHaveLength(1)
    expect(parsed.data[0]?.bookingNo).toBe('KHIG05580700')
  })

  it('parses the real voyage-list fixture', () => {
    const parsed = OneVoyageListResponseSchema.parse(ONE_VOYAGE_LIST_FIXTURE)

    expect(parsed.status).toBe(200)
    expect(parsed.code).toBe(1)
    expect(parsed.data).toHaveLength(2)
    expect(parsed.data[0]?.vesselEngName).toBe('CARL SCHULTE')
    expect(parsed.data[1]?.pod?.locationCode).toBe('BRSSZ')
  })

  it('parses the real cop-events fixture', () => {
    const parsed = OneCopEventsResponseSchema.parse(ONE_COP_EVENTS_FIXTURE)

    expect(parsed.status).toBe(200)
    expect(parsed.code).toBe(1)
    expect(parsed.data).toHaveLength(12)
    expect(parsed.data[0]?.matrixId).toBe('E012')
    expect(parsed.data[11]?.matrixId).toBe('E138')
  })

  it('rejects malformed search payloads', () => {
    const result = OneSearchResponseSchema.safeParse({
      status: 200,
      code: 1,
      message: 'Success',
    })

    expect(result.success).toBe(false)
  })
})
