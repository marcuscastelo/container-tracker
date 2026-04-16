import { beforeEach, describe, expect, it, vi } from 'vitest'

const typedFetchMock = vi.hoisted(() => vi.fn())

vi.mock('~/shared/api/typedFetch', () => ({
  typedFetch: typedFetchMock,
}))

import { fetchGlobalSearchResults } from '~/capabilities/search/ui/screens/global-search/usecases/fetchGlobalSearchResults.usecase'
import { fetchGlobalSearchSuggestions } from '~/capabilities/search/ui/screens/global-search/usecases/fetchGlobalSearchSuggestions.usecase'
import { SearchHttpResponseSchema } from '~/capabilities/search/ui/validation/globalSearchApi.validation'

describe('global search UI usecases', () => {
  beforeEach(() => {
    typedFetchMock.mockReset()
  })

  it('fetches search results with free text and repeated filters', async () => {
    const response = {
      query: {
        raw: 'CA048',
        freeTextTerms: [],
        filters: [],
        warnings: [],
      },
      results: [],
      emptyState: {
        titleKey: 'search.empty.title',
        descriptionKey: 'search.empty.description',
        examples: [],
      },
    }
    typedFetchMock.mockResolvedValue(response)

    await expect(
      fetchGlobalSearchResults({
        query: 'CA048',
        filters: ['status:IN_TRANSIT', 'carrier:MSC'],
      }),
    ).resolves.toBe(response)

    expect(typedFetchMock).toHaveBeenCalledWith(
      '/api/search?q=CA048&filter=status%3AIN_TRANSIT&filter=carrier%3AMSC',
      undefined,
      SearchHttpResponseSchema,
    )
  })

  it('omits empty query text while preserving structured suggestion filters', async () => {
    const response = {
      query: {
        raw: '',
        freeTextTerms: [],
        filters: [],
        warnings: [],
      },
      suggestions: [],
    }
    typedFetchMock.mockResolvedValue(response)

    await expect(
      fetchGlobalSearchSuggestions({
        query: '   ',
        filters: ['importer:Acme'],
      }),
    ).resolves.toBe(response)

    expect(typedFetchMock).toHaveBeenCalledWith(
      '/api/search/suggestions?filter=importer%3AAcme',
      undefined,
      expect.any(Object),
    )
  })
})
