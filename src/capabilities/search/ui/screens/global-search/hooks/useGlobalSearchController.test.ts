import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  SearchHttpResponseDto,
  SearchSuggestionsHttpResponseDto,
} from '~/capabilities/search/ui/validation/globalSearchApi.validation'

const fetchResultsMock = vi.hoisted(() => vi.fn())
const fetchSuggestionsMock = vi.hoisted(() => vi.fn())
const navigateToProcessMock = vi.hoisted(() => vi.fn())
const scheduleIntentPrefetchMock = vi.hoisted(() => vi.fn())
const scheduleVisiblePrefetchMock = vi.hoisted(() => vi.fn())
const navigateMock = vi.hoisted(() => vi.fn())
const preloadRouteMock = vi.hoisted(() => vi.fn())

vi.mock('solid-js', async () => vi.importActual('solid-js/dist/solid.js'))

vi.mock('@solidjs/router', () => ({
  useNavigate: () => navigateMock,
  usePreloadRoute: () => preloadRouteMock,
}))

vi.mock(
  '~/capabilities/search/ui/screens/global-search/usecases/fetchGlobalSearchResults.usecase',
  () => ({
    fetchGlobalSearchResults: fetchResultsMock,
  }),
)

vi.mock(
  '~/capabilities/search/ui/screens/global-search/usecases/fetchGlobalSearchSuggestions.usecase',
  () => ({
    fetchGlobalSearchSuggestions: fetchSuggestionsMock,
  }),
)

vi.mock('~/modules/process/ui/fetchProcess', () => ({
  prefetchProcessDetail: vi.fn(),
}))

vi.mock('~/shared/ui/navigation/app-navigation', () => ({
  navigateToProcess: navigateToProcessMock,
  scheduleIntentPrefetch: scheduleIntentPrefetchMock,
  scheduleVisiblePrefetch: scheduleVisiblePrefetchMock,
}))

import { createRoot } from 'solid-js'
import { useGlobalSearchController } from '~/capabilities/search/ui/screens/global-search/hooks/useGlobalSearchController'

type Deferred<T> = {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolveDeferred: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    resolveDeferred = resolve
  })

  if (resolveDeferred === undefined) {
    throw new Error('Failed to create deferred promise')
  }

  return {
    promise,
    resolve: resolveDeferred,
  }
}

function buildSearchResponse(command: {
  readonly raw: string
  readonly processId: string
  readonly title: string
}): SearchHttpResponseDto {
  return {
    query: {
      raw: command.raw,
      freeTextTerms: [],
      filters: [],
      warnings: [],
    },
    results: [
      {
        processId: command.processId,
        processReference: command.title,
        billOfLading: null,
        importerName: 'Flush Logistics',
        exporterName: null,
        carrierName: 'MSC',
        statusCode: 'IN_TRANSIT',
        eta: null,
        etaState: null,
        etaType: null,
        originLabel: 'Shanghai',
        destinationLabel: 'Santos',
        terminalLabel: null,
        terminalMultiple: false,
        depotLabel: null,
        routeLabel: 'Shanghai -> Santos',
        containerNumbers: ['MSCU1234567'],
        currentLocationLabel: null,
        currentLocationMultiple: false,
        currentVesselName: null,
        currentVesselMultiple: false,
        currentVoyageNumber: null,
        currentVoyageMultiple: false,
        hasValidationRequired: true,
        activeAlertCategories: ['data'],
        matchedBy: [
          {
            key: 'process',
            source: 'free_text',
            matchedValue: command.title,
            rawQueryValue: command.raw,
            bucket: 'text_contains',
          },
        ],
      },
    ],
    emptyState: {
      titleKey: 'search.empty.title',
      descriptionKey: 'search.empty.description',
      examples: ['container:MSCU1234567'],
    },
  }
}

function buildEmptySearchResponse(raw: string): SearchHttpResponseDto {
  return {
    query: {
      raw,
      freeTextTerms: [],
      filters: [],
      warnings: [],
    },
    results: [],
    emptyState: {
      titleKey: 'search.empty.title',
      descriptionKey: 'search.empty.description',
      examples: ['process:CA048-26'],
    },
  }
}

function buildSuggestionsResponse(raw: string): SearchSuggestionsHttpResponseDto {
  return {
    query: {
      raw,
      freeTextTerms: [],
      filters: [],
      warnings: [],
    },
    suggestions: [
      {
        kind: 'field',
        fieldKey: 'container',
        value: null,
        labelKey: null,
        fallbackLabel: 'Container',
        descriptionKey: null,
        insertText: 'container:',
      },
    ],
  }
}

function createControllerHarness() {
  return createRoot((dispose) => ({
    controller: useGlobalSearchController(),
    dispose,
  }))
}

function installDomStubs(): void {
  vi.stubGlobal('document', {
    body: {
      style: {
        overflow: '',
      },
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    querySelector: vi.fn(() => ({
      scrollIntoView: vi.fn(),
    })),
  })
  vi.stubGlobal('window', {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })
}

describe('useGlobalSearchController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    installDomStubs()
    fetchResultsMock.mockReset()
    fetchSuggestionsMock.mockReset()
    navigateToProcessMock.mockReset()
    scheduleIntentPrefetchMock.mockReset()
    scheduleVisiblePrefetchMock.mockReset()
    navigateMock.mockReset()
    preloadRouteMock.mockReset()
    fetchSuggestionsMock.mockResolvedValue(buildSuggestionsResponse(''))
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('opens with an empty interaction state and fetches/render-ready results after debounce', async () => {
    fetchResultsMock.mockResolvedValue(
      buildSearchResponse({
        raw: 'CA048',
        processId: 'process-ready',
        title: 'CA048-26',
      }),
    )
    const harness = createControllerHarness()

    harness.controller.open()
    harness.controller.setDraft('CA048')
    await Promise.resolve()
    expect(harness.controller.uiState()).toBe('loading')

    await vi.advanceTimersByTimeAsync(200)

    expect(fetchResultsMock).toHaveBeenCalledWith({
      query: 'CA048',
      filters: [],
    })
    expect(harness.controller.uiState()).toBe('ready')
    expect(harness.controller.results()).toHaveLength(1)
    expect(harness.controller.results()[0]?.processId).toBe('process-ready')
    expect(harness.controller.activeResultIndex()).toBe(0)

    harness.dispose()
  })

  it('turns empty backend responses into explicit empty UI state and examples', async () => {
    fetchResultsMock.mockResolvedValue(buildEmptySearchResponse('missing'))
    const harness = createControllerHarness()

    harness.controller.open()
    harness.controller.setDraft('missing')
    await vi.advanceTimersByTimeAsync(200)

    expect(harness.controller.uiState()).toBe('empty')
    expect(harness.controller.results()).toEqual([])
    expect(harness.controller.emptyExamples()).toEqual(['process:CA048-26'])
    expect(harness.controller.activeResultIndex()).toBe(-1)

    harness.dispose()
  })

  it('keeps the latest request authoritative when a stale response resolves last', async () => {
    const staleResponse = createDeferred<SearchHttpResponseDto>()
    fetchResultsMock.mockImplementation((command: { readonly query: string }) => {
      if (command.query === 'old') {
        return staleResponse.promise
      }
      return Promise.resolve(
        buildSearchResponse({
          raw: 'new',
          processId: 'process-new',
          title: 'NEW-26',
        }),
      )
    })
    const harness = createControllerHarness()

    harness.controller.open()
    harness.controller.setDraft('old')
    await vi.advanceTimersByTimeAsync(200)

    harness.controller.setDraft('new')
    await vi.advanceTimersByTimeAsync(200)
    expect(harness.controller.results()[0]?.processId).toBe('process-new')

    staleResponse.resolve(
      buildSearchResponse({
        raw: 'old',
        processId: 'process-old',
        title: 'OLD-26',
      }),
    )
    await Promise.resolve()

    expect(harness.controller.results()[0]?.processId).toBe('process-new')
    expect(harness.controller.uiState()).toBe('ready')

    harness.dispose()
  })

  it('accepts value suggestions as chips and clears all interaction state on close', async () => {
    const harness = createControllerHarness()

    harness.controller.acceptSuggestion({
      kind: 'value',
      fieldKey: 'container',
      value: 'MSCU1234567',
      label: 'MSCU1234567',
      description: null,
      insertText: 'container:MSCU1234567',
    })

    expect(harness.controller.chips()).toEqual([
      {
        key: 'container',
        value: 'MSCU1234567',
        label: 'Container: MSCU1234567',
      },
    ])

    harness.controller.close()

    expect(harness.controller.draft()).toBe('')
    expect(harness.controller.chips()).toEqual([])
    expect(harness.controller.results()).toEqual([])
    expect(harness.controller.suggestions()).toEqual([])
    expect(harness.controller.uiState()).toBe('empty')

    harness.dispose()
  })

  it('navigates through the shared navigation adapter and closes search state', () => {
    const harness = createControllerHarness()
    harness.controller.open()

    harness.controller.navigateToResult({
      processId: 'process-1',
      title: 'CA048-26',
      supportingId: 'ID do processo: process-1',
      matchSummary: [],
      badges: [],
      meta: [],
    })

    expect(scheduleIntentPrefetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        processId: 'process-1',
      }),
    )
    expect(navigateToProcessMock).toHaveBeenCalledWith({
      navigate: navigateMock,
      processId: 'process-1',
    })
    expect(harness.controller.isOpen()).toBe(false)

    harness.dispose()
  })
})
