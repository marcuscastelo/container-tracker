import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchPilStatus } from '~/modules/tracking/infrastructure/carriers/fetchers/pil.fetcher'
import {
  PIL_MISSING_TABLE_PAYLOAD,
  PIL_SAMPLE_CONTAINER_NUMBER,
  PIL_UNSUCCESSFUL_PAYLOAD,
  PIL_VALID_PAYLOAD,
} from '~/modules/tracking/infrastructure/carriers/tests/helpers/pil.fixture'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}))

describe('fetchPilStatus', () => {
  const mockedGet = vi.mocked(axios.get)

  beforeEach(() => {
    mockedGet.mockReset()
  })

  it('returns the raw payload and no parse_error for a valid response', async () => {
    mockedGet.mockResolvedValue({
      status: 200,
      data: JSON.stringify(PIL_VALID_PAYLOAD),
    })

    const result = await fetchPilStatus(PIL_SAMPLE_CONTAINER_NUMBER)

    expect(result.provider).toBe('pil')
    expect(result.payload).toEqual(PIL_VALID_PAYLOAD)
    expect(result.parseError).toBeNull()
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/u)
    expect(mockedGet).toHaveBeenCalledWith(
      expect.stringContaining(`refNo=${PIL_SAMPLE_CONTAINER_NUMBER}`),
      expect.objectContaining({
        responseType: 'text',
        headers: expect.objectContaining({
          'X-Requested-With': 'XMLHttpRequest',
        }),
      }),
    )
  })

  it('marks success=false responses as fatal parse errors while preserving the raw payload', async () => {
    mockedGet.mockResolvedValue({
      status: 200,
      data: JSON.stringify(PIL_UNSUCCESSFUL_PAYLOAD),
    })

    const result = await fetchPilStatus(PIL_SAMPLE_CONTAINER_NUMBER)

    expect(result.payload).toEqual(PIL_UNSUCCESSFUL_PAYLOAD)
    expect(result.parseError).toBe('PIL returned an unsuccessful tracking response')
  })

  it('marks missing detailed tables as fatal parse errors while preserving the raw payload', async () => {
    mockedGet.mockResolvedValue({
      status: 200,
      data: JSON.stringify(PIL_MISSING_TABLE_PAYLOAD),
    })

    const result = await fetchPilStatus(PIL_SAMPLE_CONTAINER_NUMBER)

    expect(result.payload).toEqual(PIL_MISSING_TABLE_PAYLOAD)
    expect(result.parseError).toBe('PIL payload missing detailed event table')
  })
})
