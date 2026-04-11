import { describe, expect, it, vi } from 'vitest'
import type {
  GlobalSearchResponse,
  GlobalSearchSuggestionsResponse,
} from '~/capabilities/search/application/global-search.types'
import { createSearchControllers } from '~/capabilities/search/interface/http/search.controllers'
import {
  SearchHttpResponseSchema,
  SearchSuggestionsHttpResponseSchema,
} from '~/capabilities/search/interface/http/search.schemas'

function createControllers() {
  const search = vi.fn(
    async (): Promise<GlobalSearchResponse> => ({
      query: {
        raw: 'carrier:MSC flush',
        freeTextTerms: [
          {
            rawValue: 'flush',
            normalizedValue: 'flush',
            kind: 'text' as const,
          },
        ],
        filters: [
          {
            key: 'carrier',
            rawKey: 'carrier',
            rawValue: 'MSC',
            normalizedValue: 'msc',
            source: 'chip' as const,
            supported: true,
          },
        ],
        warnings: [],
      },
      results: [
        {
          processId: 'process-1',
          processReference: 'CA048-26',
          billOfLading: 'MEDUP6124762',
          importerName: 'Flush Logistics',
          exporterName: 'Exporter Co',
          carrierName: 'MSC',
          statusCode: 'DELIVERED',
          eta: null,
          etaState: null,
          etaType: null,
          originLabel: 'Santos',
          destinationLabel: 'Karachi, Pakistan',
          terminalLabel: 'Movecta',
          terminalMultiple: false,
          depotLabel: 'Santos Brasil',
          routeLabel: 'Santos -> Karachi, Pakistan',
          containerNumbers: ['MSKU1234567'],
          currentLocationLabel: 'Karachi, Pakistan',
          currentLocationMultiple: false,
          currentVesselName: 'MSC Orion',
          currentVesselMultiple: false,
          currentVoyageNumber: '001E',
          currentVoyageMultiple: false,
          hasValidationRequired: true,
          activeAlertCategories: ['eta'] as const,
          matchedBy: [
            {
              key: 'carrier',
              source: 'filter' as const,
              matchedValue: 'MSC',
              rawQueryValue: 'MSC',
              bucket: 'structured_exact' as const,
            },
          ],
        },
      ],
      emptyState: {
        titleKey: 'search.empty.title',
        descriptionKey: 'search.empty.description',
        examples: ['carrier:MSC'],
      },
    }),
  )

  const suggest = vi.fn(
    async (): Promise<GlobalSearchSuggestionsResponse> => ({
      query: {
        raw: 'status:deli',
        freeTextTerms: [],
        filters: [],
        warnings: [],
      },
      suggestions: [
        {
          kind: 'value' as const,
          fieldKey: 'status',
          value: 'DELIVERED',
          labelKey: 'tracking.status.DELIVERED',
          fallbackLabel: 'Entregue',
          descriptionKey: null,
          insertText: 'DELIVERED',
        },
      ],
    }),
  )

  return {
    controllers: createSearchControllers({
      searchController: {
        search,
        suggest,
      },
    }),
    search,
    suggest,
  }
}

describe('search controllers', () => {
  it('returns structured search payload for GET /api/search and forwards repeated filter params', async () => {
    const { controllers, search } = createControllers()

    const response = await controllers.search({
      request: new Request(
        'http://localhost/api/search?q=flush&filter=carrier:MSC&filter=status:DELIVERED',
      ),
    })
    const body = SearchHttpResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(search).toHaveBeenCalledWith({
      query: 'flush',
      filters: ['carrier:MSC', 'status:DELIVERED'],
    })
    expect(body.results[0]).toEqual(
      expect.objectContaining({
        processId: 'process-1',
        processReference: 'CA048-26',
        statusCode: 'DELIVERED',
        hasValidationRequired: true,
      }),
    )
  })

  it('returns structured suggestions payload for GET /api/search/suggestions', async () => {
    const { controllers, suggest } = createControllers()

    const response = await controllers.suggestions({
      request: new Request(
        'http://localhost/api/search/suggestions?q=status:deli&filter=carrier:MSC',
      ),
    })
    const body = SearchSuggestionsHttpResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(suggest).toHaveBeenCalledWith({
      query: 'status:deli',
      filters: ['carrier:MSC'],
    })
    expect(body.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'value',
          fieldKey: 'status',
          value: 'DELIVERED',
        }),
      ]),
    )
  })
})
