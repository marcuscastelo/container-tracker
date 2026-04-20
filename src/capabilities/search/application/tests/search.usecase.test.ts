import { describe, expect, it, vi } from 'vitest'
import type { SearchProcessRecord } from '~/capabilities/search/application/global-search-documents'
import {
  type CreateSearchUseCaseDeps,
  createSearchSuggestionsUseCase,
  createSearchUseCase,
} from '~/capabilities/search/application/search.usecase'
import type { TrackingGlobalSearchProjection } from '~/modules/tracking/application/projection/tracking.global-search.readmodel'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.active-alert.readmodel'
import { temporalDtoFromCanonical } from '~/shared/time/tests/helpers'

function createProcessRecord(command: {
  readonly processId: string
  readonly reference?: string | null
  readonly importerName?: string | null
  readonly exporterName?: string | null
  readonly carrier?: string | null
  readonly billOfLading?: string | null
  readonly origin?: string | null
  readonly destination?: string | null
  readonly depositary?: string | null
  readonly containerNumbers: readonly string[]
  readonly statusCode?: string
  readonly eta?: ReturnType<typeof temporalDtoFromCanonical> | null
  readonly hasValidationRequired?: boolean
}): SearchProcessRecord {
  return {
    pwc: {
      process: {
        id: command.processId,
        reference: command.reference ?? null,
        origin: command.origin ?? null,
        destination: command.destination ?? null,
        carrier: command.carrier ?? null,
        billOfLading: command.billOfLading ?? null,
        importerName: command.importerName ?? null,
        exporterName: command.exporterName ?? null,
        depositary: command.depositary ?? null,
      },
      containers: command.containerNumbers.map((containerNumber) => ({ containerNumber })),
    },
    summary: {
      process_status: command.statusCode ?? 'IN_TRANSIT',
      eta: command.eta ?? null,
      tracking_validation: {
        hasIssues: command.hasValidationRequired ?? false,
      },
    },
  }
}

function createDeps(command?: {
  readonly processes?: readonly SearchProcessRecord[]
  readonly tracking?: readonly TrackingGlobalSearchProjection[]
  readonly alerts?: readonly Pick<TrackingActiveAlertReadModel, 'process_id' | 'type'>[]
}) {
  const listProcessesWithOperationalSummary = vi.fn(async () => ({
    processes: command?.processes ?? [],
  }))
  const listGlobalSearchProjections = vi.fn(async () => command?.tracking ?? [])
  const listActiveAlertReadModel = vi.fn(async () => ({
    alerts:
      command?.alerts?.map(
        (alert, index) =>
          ({
            alert_id: `alert-${index}`,
            process_id: alert.process_id,
            container_id: `container-${index}`,
            category: 'monitoring',
            severity: 'warning',
            type: alert.type,
            message_key: 'alerts.etaPassed',
            message_params: {},
            generated_at: '2026-04-01T00:00:00.000Z',
            fingerprint: null,
            is_active: true,
            retroactive: false,
          }) satisfies TrackingActiveAlertReadModel,
      ) ?? [],
  }))

  return {
    deps: {
      processUseCases: {
        listProcessesWithOperationalSummary,
      },
      trackingUseCases: {
        listGlobalSearchProjections,
        listActiveAlertReadModel,
      },
    } satisfies CreateSearchUseCaseDeps,
    listProcessesWithOperationalSummary,
    listGlobalSearchProjections,
    listActiveAlertReadModel,
  }
}

describe('createSearchUseCase', () => {
  it('returns empty state without loading documents when search input is empty', async () => {
    const {
      deps,
      listProcessesWithOperationalSummary,
      listGlobalSearchProjections,
      listActiveAlertReadModel,
    } = createDeps({
      processes: [
        createProcessRecord({
          processId: 'process-idle',
          reference: 'CA000-26',
          containerNumbers: ['MSKU0000000'],
        }),
      ],
    })
    const search = createSearchUseCase(deps)

    const response = await search({
      query: '   ',
      filters: [],
    })

    expect(response.results).toEqual([])
    expect(listProcessesWithOperationalSummary).not.toHaveBeenCalled()
    expect(listGlobalSearchProjections).not.toHaveBeenCalled()
    expect(listActiveAlertReadModel).not.toHaveBeenCalled()
  })

  it('matches free text and structured filters with AND semantics', async () => {
    const { deps } = createDeps({
      processes: [
        createProcessRecord({
          processId: 'process-1',
          reference: 'CA048-26',
          importerName: 'Flush Logistics',
          carrier: 'MSC',
          billOfLading: 'MEDUP6124762',
          destination: 'Karachi, Pakistan',
          containerNumbers: ['MSKU1234567'],
          statusCode: 'DELIVERED',
        }),
        createProcessRecord({
          processId: 'process-2',
          reference: 'CA049-26',
          importerName: 'Other Importer',
          carrier: 'MAERSK',
          containerNumbers: ['MSKU7654321'],
          statusCode: 'IN_TRANSIT',
        }),
      ],
    })
    const search = createSearchUseCase(deps)

    const response = await search({
      query: 'flush',
      filters: ['carrier:MSC', 'status:delivered'],
    })

    expect(response.results).toHaveLength(1)
    expect(response.results[0]).toEqual(
      expect.objectContaining({
        processId: 'process-1',
        processReference: 'CA048-26',
        importerName: 'Flush Logistics',
        carrierName: 'MSC',
        statusCode: 'DELIVERED',
      }),
    )
    expect(response.results[0]?.matchedBy).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'carrier' }),
        expect.objectContaining({ key: 'status' }),
      ]),
    )
  })

  it('matches ETA by free text day/month and supports before/after/month filters', async () => {
    const { deps } = createDeps({
      processes: [
        createProcessRecord({
          processId: 'process-eta-1',
          reference: 'CA050-26',
          containerNumbers: ['MSKU1111111'],
          eta: temporalDtoFromCanonical('2026-05-06'),
        }),
        createProcessRecord({
          processId: 'process-eta-2',
          reference: 'CA051-26',
          containerNumbers: ['MSKU2222222'],
          eta: temporalDtoFromCanonical('2026-05-20'),
        }),
      ],
    })
    const search = createSearchUseCase(deps)

    const freeText = await search({ query: '06/05' })
    const before = await search({ query: '', filters: ['eta_before:10/05/2026'] })
    const after = await search({ query: '', filters: ['eta_after:10/05/2026'] })
    const month = await search({ query: '', filters: ['eta_month:05/2026'] })

    expect(freeText.results.map((item) => item.processId)).toEqual(['process-eta-1'])
    expect(before.results.map((item) => item.processId)).toEqual(['process-eta-1'])
    expect(after.results.map((item) => item.processId)).toEqual(['process-eta-2'])
    expect(month.results.map((item) => item.processId)).toEqual(['process-eta-1', 'process-eta-2'])
  })

  it('preserves ambiguity for current context and terminal displays', async () => {
    const { deps } = createDeps({
      processes: [
        createProcessRecord({
          processId: 'process-ctx',
          reference: 'CA052-26',
          containerNumbers: ['MSKU1111111', 'MSKU2222222'],
        }),
      ],
      tracking: [
        {
          processId: 'process-ctx',
          containerId: 'container-1',
          containerNumber: 'MSKU1111111',
          statusCode: 'IN_TRANSIT',
          eta: null,
          etaState: null,
          etaType: null,
          currentLocationCode: 'BRSSZ',
          currentLocationDisplay: 'Santos',
          currentVesselName: 'MSC A',
          currentVoyage: '001E',
          currentVesselVisible: true,
          routeOriginCode: 'BRSSZ',
          routeOriginDisplay: 'Santos',
          routeDestinationCode: 'PKKHI',
          routeDestinationDisplay: 'Karachi, Pakistan',
          routeDisplays: ['Santos', 'Karachi, Pakistan'],
          routeCountryTokens: ['brazil', 'pakistan'],
          terminalLocationLabels: ['Movecta'],
        },
        {
          processId: 'process-ctx',
          containerId: 'container-2',
          containerNumber: 'MSKU2222222',
          statusCode: 'IN_TRANSIT',
          eta: null,
          etaState: null,
          etaType: null,
          currentLocationCode: 'BRRIO',
          currentLocationDisplay: 'Rio de Janeiro',
          currentVesselName: 'MSC B',
          currentVoyage: '002E',
          currentVesselVisible: true,
          routeOriginCode: 'BRRIO',
          routeOriginDisplay: 'Rio de Janeiro',
          routeDestinationCode: 'PKKHI',
          routeDestinationDisplay: 'Karachi, Pakistan',
          routeDisplays: ['Rio de Janeiro', 'Karachi, Pakistan'],
          routeCountryTokens: ['brazil', 'pakistan'],
          terminalLocationLabels: ['Santos Brasil'],
        },
      ],
    })
    const search = createSearchUseCase(deps)

    const response = await search({ query: 'karachi' })

    expect(response.results).toHaveLength(1)
    expect(response.results[0]).toEqual(
      expect.objectContaining({
        processId: 'process-ctx',
        currentLocationLabel: null,
        currentLocationMultiple: true,
        currentVesselName: null,
        currentVesselMultiple: true,
        currentVoyageNumber: null,
        currentVoyageMultiple: true,
        terminalLabel: null,
        terminalMultiple: true,
      }),
    )
  })

  it('ranks exact strong identifiers ahead of text contains and keeps processReference separate from processId', async () => {
    const { deps } = createDeps({
      processes: [
        createProcessRecord({
          processId: 'process-identifier-exact',
          reference: 'CA053-26',
          containerNumbers: ['GLDU2928252'],
          importerName: 'GLDU Importer',
        }),
        createProcessRecord({
          processId: 'process-text-only',
          reference: 'CA054-26',
          containerNumbers: ['MSKU7654321'],
          importerName: 'Importer GLDU2928252',
        }),
      ],
    })
    const search = createSearchUseCase(deps)

    const response = await search({ query: 'GLDU2928252' })

    expect(response.results.map((item) => item.processId)).toEqual([
      'process-identifier-exact',
      'process-text-only',
    ])
    expect(response.results[0]).toEqual(
      expect.objectContaining({
        processId: 'process-identifier-exact',
        processReference: 'CA053-26',
      }),
    )
  })

  it('returns field suggestions and enum value suggestions', async () => {
    const { deps } = createDeps()
    const suggest = createSearchSuggestionsUseCase(deps)

    const fieldSuggestions = await suggest({ query: 'sta' })
    const valueSuggestions = await suggest({ query: 'status:deli' })

    expect(fieldSuggestions.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'field',
          fieldKey: 'status',
        }),
      ]),
    )

    expect(valueSuggestions.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'value',
          fieldKey: 'status',
          value: 'DELIVERED',
        }),
      ]),
    )
  })

  it('skips document loading for empty draft, field suggestions, and enum value suggestions', async () => {
    const {
      deps,
      listProcessesWithOperationalSummary,
      listGlobalSearchProjections,
      listActiveAlertReadModel,
    } = createDeps()
    const suggest = createSearchSuggestionsUseCase(deps)

    await suggest({ query: '   ' })
    await suggest({ query: 'sta' })
    await suggest({ query: 'status:deli' })

    expect(listProcessesWithOperationalSummary).not.toHaveBeenCalled()
    expect(listGlobalSearchProjections).not.toHaveBeenCalled()
    expect(listActiveAlertReadModel).not.toHaveBeenCalled()
  })

  it('loads documents only for document-backed value suggestions', async () => {
    const {
      deps,
      listProcessesWithOperationalSummary,
      listGlobalSearchProjections,
      listActiveAlertReadModel,
    } = createDeps({
      processes: [
        createProcessRecord({
          processId: 'process-suggestions',
          reference: 'CA060-26',
          importerName: 'Flush Logistics',
          containerNumbers: ['MSKU1234567'],
        }),
      ],
    })
    const suggest = createSearchSuggestionsUseCase(deps)

    const response = await suggest({ query: 'importer:flu' })

    expect(response.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'value',
          fieldKey: 'importer',
          value: 'Flush Logistics',
        }),
      ]),
    )
    expect(listProcessesWithOperationalSummary).toHaveBeenCalledTimes(1)
    expect(listGlobalSearchProjections).toHaveBeenCalledTimes(1)
    expect(listActiveAlertReadModel).toHaveBeenCalledTimes(1)
  })
})
