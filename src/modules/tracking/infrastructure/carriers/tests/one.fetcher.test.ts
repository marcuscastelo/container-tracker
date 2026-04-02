import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchOneStatus } from '~/modules/tracking/infrastructure/carriers/fetchers/one.fetcher'
import { OneRawSnapshotSchema } from '~/modules/tracking/infrastructure/carriers/schemas/api/one.api.schema'
import {
  ONE_COP_EVENTS_FIXTURE,
  ONE_SAMPLE_BOOKING_NO,
  ONE_SAMPLE_CONTAINER_NUMBER,
  ONE_SEARCH_FIXTURE,
  ONE_VOYAGE_LIST_FIXTURE,
} from '~/modules/tracking/infrastructure/carriers/tests/helpers/one.fixture'

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

describe('fetchOneStatus', () => {
  const mockedPost = vi.mocked(axios.post)
  const mockedGet = vi.mocked(axios.get)
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

  beforeEach(() => {
    mockedPost.mockReset()
    mockedGet.mockReset()
  })

  afterEach(() => {
    infoSpy.mockClear()
    warnSpy.mockClear()
  })

  it('returns the consolidated raw snapshot and no parse_error for a valid response', async () => {
    mockedPost.mockResolvedValueOnce({
      status: 200,
      data: ONE_SEARCH_FIXTURE,
    })
    mockedGet
      .mockResolvedValueOnce({
        status: 200,
        data: ONE_VOYAGE_LIST_FIXTURE,
      })
      .mockResolvedValueOnce({
        status: 200,
        data: ONE_COP_EVENTS_FIXTURE,
      })

    const result = await fetchOneStatus(ONE_SAMPLE_CONTAINER_NUMBER)
    const rawSnapshot = OneRawSnapshotSchema.parse(result.payload)

    expect(result.provider).toBe('one')
    expect(result.parseError).toBeNull()
    expect(rawSnapshot.requestMeta).toEqual({
      containerNumber: ONE_SAMPLE_CONTAINER_NUMBER,
      bookingNo: ONE_SAMPLE_BOOKING_NO,
    })
    expect(rawSnapshot.endpointMeta.search).toEqual({
      ok: true,
      statusCode: 200,
      error: null,
      receivedCount: 1,
    })
    expect(rawSnapshot.endpointMeta.voyageList.receivedCount).toBe(2)
    expect(rawSnapshot.endpointMeta.copEvents.receivedCount).toBe(12)
    expect(mockedPost).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/edh/containers/track-and-trace/search'),
      expect.objectContaining({
        filters: {
          search_text: ONE_SAMPLE_CONTAINER_NUMBER,
          search_type: 'CNTR_NO',
        },
      }),
      expect.objectContaining({
        timeout: 30_000,
      }),
    )
    expect(mockedGet).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/api/v1/edh/vessel/track-and-trace/voyage-list'),
      expect.objectContaining({
        params: { booking_no: ONE_SAMPLE_BOOKING_NO },
      }),
    )
    expect(mockedGet).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/v1/edh/containers/track-and-trace/cop-events'),
      expect.objectContaining({
        params: {
          booking_no: ONE_SAMPLE_BOOKING_NO,
          container_no: ONE_SAMPLE_CONTAINER_NUMBER,
        },
      }),
    )
  })

  it('marks search-without-results as a parse error and skips secondary endpoints', async () => {
    mockedPost.mockResolvedValueOnce({
      status: 200,
      data: {
        ...ONE_SEARCH_FIXTURE,
        total: 0,
        data: [],
      },
    })

    const result = await fetchOneStatus(ONE_SAMPLE_CONTAINER_NUMBER)
    const rawSnapshot = OneRawSnapshotSchema.parse(result.payload)

    expect(result.parseError).toContain('ONE search returned no container match')
    expect(rawSnapshot.voyageList).toBeNull()
    expect(rawSnapshot.copEvents).toBeNull()
    expect(rawSnapshot.endpointMeta.voyageList.error).toContain('bookingNo')
    expect(rawSnapshot.endpointMeta.copEvents.error).toContain('bookingNo')
    expect(mockedGet).not.toHaveBeenCalled()
  })

  it('marks missing bookingNo as a parse error while preserving the raw search payload', async () => {
    mockedPost.mockResolvedValueOnce({
      status: 200,
      data: {
        ...ONE_SEARCH_FIXTURE,
        data: [
          {
            ...ONE_SEARCH_FIXTURE.data[0],
            bookingNo: null,
          },
        ],
      },
    })

    const result = await fetchOneStatus(ONE_SAMPLE_CONTAINER_NUMBER)
    const rawSnapshot = OneRawSnapshotSchema.parse(result.payload)

    expect(result.parseError).toContain('ONE search response missing bookingNo')
    expect(rawSnapshot.search).not.toBeNull()
    expect(rawSnapshot.voyageList).toBeNull()
    expect(rawSnapshot.copEvents).toBeNull()
    expect(mockedGet).not.toHaveBeenCalled()
  })

  it('preserves a partial snapshot when voyage-list transport fails but cop-events succeeds', async () => {
    mockedPost.mockResolvedValueOnce({
      status: 200,
      data: ONE_SEARCH_FIXTURE,
    })
    mockedGet.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({
      status: 200,
      data: ONE_COP_EVENTS_FIXTURE,
    })

    const result = await fetchOneStatus(ONE_SAMPLE_CONTAINER_NUMBER)
    const rawSnapshot = OneRawSnapshotSchema.parse(result.payload)

    expect(result.parseError).toContain('ONE voyage-list transport failed: timeout')
    expect(rawSnapshot.endpointMeta.voyageList.ok).toBe(false)
    expect(rawSnapshot.endpointMeta.voyageList.error).toContain('timeout')
    expect(rawSnapshot.endpointMeta.copEvents.ok).toBe(true)
    expect(rawSnapshot.copEvents).toEqual(ONE_COP_EVENTS_FIXTURE)
  })
})
