import { describe, expect, it } from 'vitest'
import { toGlobalSearchResponseVm } from '~/capabilities/search/ui/screens/global-search/mappers/globalSearch.ui-mapper'
import { useTranslation } from '~/shared/localization/i18n'

describe('globalSearch.ui-mapper', () => {
  it('uses processReference as the primary result title before BL, container and processId', () => {
    const translation = useTranslation()

    const viewModel = toGlobalSearchResponseVm(
      {
        query: {
          raw: 'MSKU1234567',
          freeTextTerms: [],
          filters: [],
          warnings: [],
        },
        results: [
          {
            processId: '7aae3129-c88a-45a2-aa9e-f2fbecb26bd7',
            processReference: 'CA048-26',
            billOfLading: 'MEDUP6124762',
            importerName: 'Flush Logistics',
            exporterName: null,
            carrierName: 'MSC',
            statusCode: 'DELIVERED',
            eta: null,
            etaState: null,
            etaType: null,
            originLabel: null,
            destinationLabel: null,
            terminalLabel: null,
            terminalMultiple: false,
            depotLabel: null,
            routeLabel: null,
            containerNumbers: ['MSKU1234567'],
            currentLocationLabel: null,
            currentLocationMultiple: false,
            currentVesselName: null,
            currentVesselMultiple: false,
            currentVoyageNumber: null,
            currentVoyageMultiple: false,
            hasValidationRequired: false,
            activeAlertCategories: [],
            matchedBy: [],
          },
        ],
        emptyState: {
          titleKey: 'search.empty.title',
          descriptionKey: 'search.empty.description',
          examples: [],
        },
      },
      translation,
    )

    expect(viewModel.items[0]).toEqual(
      expect.objectContaining({
        title: 'CA048-26',
        supportingId: `ID do processo: 7aae3129-c88a-45a2-aa9e-f2fbecb26bd7`,
      }),
    )
  })
})
