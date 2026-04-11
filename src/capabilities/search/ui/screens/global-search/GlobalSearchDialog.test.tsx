import { createComponent, createMemo } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  GlobalSearchFilterChipVM,
  GlobalSearchResultItemVM,
  GlobalSearchSuggestionVM,
} from '~/capabilities/search/ui/screens/global-search/types/global-search.vm'

type DialogControllerStub = {
  isOpen: () => boolean
  chips: () => readonly GlobalSearchFilterChipVM[]
  draft: () => string
  results: () => readonly GlobalSearchResultItemVM[]
  suggestions: () => readonly GlobalSearchSuggestionVM[]
  uiState: () => 'loading' | 'empty' | 'error' | 'ready'
  activeResultIndex: () => number
  activeSuggestionIndex: () => number
  emptyTitle: () => string
  emptyDescription: () => string
  emptyExamples: () => readonly string[]
  showSuggestions: () => boolean
  open: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  setDraft: ReturnType<typeof vi.fn>
  handleComposerKeyDown: ReturnType<typeof vi.fn>
  removeChip: ReturnType<typeof vi.fn>
  clearComposer: ReturnType<typeof vi.fn>
  setInputRef: ReturnType<typeof vi.fn>
  acceptSuggestion: ReturnType<typeof vi.fn>
  setActiveSuggestionIndex: ReturnType<typeof vi.fn>
  navigateToResult: ReturnType<typeof vi.fn>
  prefetchResultIntent: ReturnType<typeof vi.fn>
  prefetchVisibleResults: ReturnType<typeof vi.fn>
  setActiveResultIndex: ReturnType<typeof vi.fn>
}

type SearchTriggerProps = {
  readonly placeholder: string
  readonly shortcutLabel: string
  readonly onOpen: () => void
}

type GlobalSearchComposerProps = {
  readonly expanded: boolean
  readonly listboxId: string | undefined
  readonly activeDescendantId: string | undefined
  readonly onDraftInput: (value: string) => void
  readonly onRemoveChip: (chipId: string) => void
  readonly onClear: () => void
}

type GlobalSearchSuggestionsProps = {
  readonly activeIndex: number
  readonly listLabel: string
  readonly onSelect: (suggestion: GlobalSearchSuggestionVM) => void
  readonly onHover: (index: number) => void
}

type GlobalSearchBodyProps = {
  readonly uiState: string
  readonly showDiscoveryState: boolean
  readonly showEmptyState: boolean
  readonly activeIndex: number
  readonly listLabel: string
  readonly onSelect: (item: GlobalSearchResultItemVM) => void
  readonly onHover: (index: number) => void
  readonly onVisiblePrefetch: (processIds: readonly string[]) => void
}

type FooterProps = {
  readonly navigateLabel: string
  readonly selectLabel: string
  readonly closeLabel: string
}

const controllerState = vi.hoisted<DialogControllerStub>(() => {
  const emptyChips: readonly GlobalSearchFilterChipVM[] = []
  const emptyResults: readonly GlobalSearchResultItemVM[] = []
  const emptySuggestions: readonly GlobalSearchSuggestionVM[] = []
  const emptyExamples: readonly string[] = []

  return {
    isOpen: () => false,
    chips: () => emptyChips,
    draft: () => '',
    results: () => emptyResults,
    suggestions: () => emptySuggestions,
    uiState: () => 'empty',
    activeResultIndex: () => -1,
    activeSuggestionIndex: () => -1,
    emptyTitle: () => '',
    emptyDescription: () => '',
    emptyExamples: () => emptyExamples,
    showSuggestions: () => false,
    open: vi.fn(),
    close: vi.fn(),
    setDraft: vi.fn(),
    handleComposerKeyDown: vi.fn(),
    removeChip: vi.fn(),
    clearComposer: vi.fn(),
    setInputRef: vi.fn(),
    acceptSuggestion: vi.fn(),
    setActiveSuggestionIndex: vi.fn(),
    navigateToResult: vi.fn(),
    prefetchResultIntent: vi.fn(),
    prefetchVisibleResults: vi.fn(),
    setActiveResultIndex: vi.fn(),
  }
})

const capturedInteractions = vi.hoisted<{
  triggerOpen: (() => () => void) | undefined
  composerDraftInput: (() => (value: string) => void) | undefined
  composerRemoveChip: (() => (chipId: string) => void) | undefined
  composerClear: (() => () => void) | undefined
  suggestionHover: (() => (index: number) => void) | undefined
  suggestionSelect: (() => (suggestion: GlobalSearchSuggestionVM) => void) | undefined
  resultHover: (() => (index: number) => void) | undefined
  resultSelect: (() => (item: GlobalSearchResultItemVM) => void) | undefined
  visiblePrefetch: (() => (processIds: readonly string[]) => void) | undefined
}>(() => ({
  triggerOpen: undefined,
  composerDraftInput: undefined,
  composerRemoveChip: undefined,
  composerClear: undefined,
  suggestionHover: undefined,
  suggestionSelect: undefined,
  resultHover: undefined,
  resultSelect: undefined,
  visiblePrefetch: undefined,
}))

vi.mock('~/capabilities/search/ui/screens/global-search/hooks/useGlobalSearchController', () => ({
  useGlobalSearchController: () => controllerState,
}))

vi.mock('~/capabilities/search/ui/SearchOverlay.footer', () => ({
  SearchOverlayFooter: (props: FooterProps) => (
    <div>
      footer:{props.navigateLabel}:{props.selectLabel}:{props.closeLabel}
    </div>
  ),
}))

vi.mock('~/capabilities/search/ui/SearchOverlay.trigger', () => ({
  SearchTriggerButton: (props: SearchTriggerProps) => {
    capturedInteractions.triggerOpen = createMemo(() => props.onOpen)

    return (
      <div>
        trigger:{props.placeholder}:{props.shortcutLabel}
      </div>
    )
  },
}))

vi.mock('~/capabilities/search/ui/screens/global-search/views/GlobalSearchComposerView', () => ({
  GlobalSearchComposerView: (props: GlobalSearchComposerProps) => {
    capturedInteractions.composerDraftInput = createMemo(() => props.onDraftInput)
    capturedInteractions.composerRemoveChip = createMemo(() => props.onRemoveChip)
    capturedInteractions.composerClear = createMemo(() => props.onClear)

    return (
      <div>
        composer:{String(props.expanded)}:{props.listboxId ?? 'none'}:
        {props.activeDescendantId ?? 'none'}
      </div>
    )
  },
}))

vi.mock('~/capabilities/search/ui/screens/global-search/views/GlobalSearchSuggestionsView', () => ({
  GlobalSearchSuggestionsView: (props: GlobalSearchSuggestionsProps) => {
    capturedInteractions.suggestionHover = createMemo(() => props.onHover)
    capturedInteractions.suggestionSelect = createMemo(() => props.onSelect)

    return (
      <div>
        suggestions:{props.activeIndex}:{props.listLabel}
      </div>
    )
  },
}))

vi.mock('~/capabilities/search/ui/screens/global-search/views/GlobalSearchBodyView', () => ({
  GlobalSearchBodyView: (props: GlobalSearchBodyProps) => {
    capturedInteractions.resultHover = createMemo(() => props.onHover)
    capturedInteractions.resultSelect = createMemo(() => props.onSelect)
    capturedInteractions.visiblePrefetch = createMemo(() => props.onVisiblePrefetch)

    return (
      <div>
        body:{props.uiState}:{String(props.showDiscoveryState)}:{String(props.showEmptyState)}:
        {props.activeIndex}:{props.listLabel}
      </div>
    )
  },
}))

import { GlobalSearchDialog } from '~/capabilities/search/ui/screens/global-search/GlobalSearchDialog'

function normalizeSsrHtml(html: string): string {
  return html.replaceAll('<!--$-->', '').replaceAll('<!--/-->', '')
}

describe('GlobalSearchDialog', () => {
  beforeEach(() => {
    controllerState.open.mockReset()
    controllerState.close.mockReset()
    controllerState.setDraft.mockReset()
    controllerState.removeChip.mockReset()
    controllerState.clearComposer.mockReset()
    controllerState.acceptSuggestion.mockReset()
    controllerState.setActiveSuggestionIndex.mockReset()
    controllerState.navigateToResult.mockReset()
    controllerState.prefetchResultIntent.mockReset()
    controllerState.prefetchVisibleResults.mockReset()
    controllerState.setActiveResultIndex.mockReset()
    controllerState.isOpen = () => false
    controllerState.chips = () => []
    controllerState.draft = () => ''
    controllerState.results = () => []
    controllerState.suggestions = () => []
    controllerState.uiState = () => 'empty'
    controllerState.activeResultIndex = () => -1
    controllerState.activeSuggestionIndex = () => -1
    controllerState.emptyTitle = () => ''
    controllerState.emptyDescription = () => ''
    controllerState.emptyExamples = () => []
    controllerState.showSuggestions = () => false
    capturedInteractions.triggerOpen = undefined
    capturedInteractions.composerDraftInput = undefined
    capturedInteractions.composerRemoveChip = undefined
    capturedInteractions.composerClear = undefined
    capturedInteractions.suggestionHover = undefined
    capturedInteractions.suggestionSelect = undefined
    capturedInteractions.resultHover = undefined
    capturedInteractions.resultSelect = undefined
    capturedInteractions.visiblePrefetch = undefined
  })

  it('renders only the trigger when the dialog is closed', () => {
    const html = normalizeSsrHtml(renderToString(() => createComponent(GlobalSearchDialog, {})))

    expect(html).toContain('trigger:Buscar processos, filtros e ETA...')
    expect(html).not.toContain('composer:')
    expect(html).not.toContain('body:')
  })

  it('wires composer, suggestions and body with active listbox state when dialog is open', () => {
    controllerState.isOpen = () => true
    controllerState.showSuggestions = () => true
    controllerState.uiState = () => 'ready'
    controllerState.activeSuggestionIndex = () => 0
    controllerState.activeResultIndex = () => 1
    controllerState.results = () => [
      {
        processId: 'process-1',
        title: 'CA048-26',
        supportingId: 'ID do processo: process-1',
        badges: [],
        matchSummary: [],
        meta: [],
      },
    ]
    controllerState.suggestions = () => [
      {
        kind: 'field',
        fieldKey: 'container',
        value: null,
        label: 'Container',
        description: null,
        insertText: 'container:',
      },
    ]

    const html = normalizeSsrHtml(renderToString(() => createComponent(GlobalSearchDialog, {})))

    expect(html).toContain('role="dialog"')
    expect(html).toContain(
      'composer:true:global-search-suggestions-list:global-search-suggestion-0',
    )
    expect(html).toContain('suggestions:0:Sugestões de busca')
    expect(html).toContain('body:ready:false:false:1:Resultados da busca')
    expect(html).toContain('footer:Navegar:Selecionar:Fechar')
  })

  it('forwards composer, suggestion and result interactions to the controller', () => {
    const result: GlobalSearchResultItemVM = {
      processId: 'process-1',
      title: 'CA048-26',
      supportingId: 'ID do processo: process-1',
      badges: [],
      matchSummary: [],
      meta: [],
    }
    const suggestion: GlobalSearchSuggestionVM = {
      kind: 'field',
      fieldKey: 'container',
      value: null,
      label: 'Container',
      description: null,
      insertText: 'container:',
    }

    controllerState.isOpen = () => true
    controllerState.showSuggestions = () => true
    controllerState.uiState = () => 'ready'
    controllerState.results = () => [result]
    controllerState.suggestions = () => [suggestion]

    renderToString(() => createComponent(GlobalSearchDialog, {}))

    capturedInteractions.triggerOpen?.()()
    capturedInteractions.composerDraftInput?.()('eta:santos')
    capturedInteractions.composerRemoveChip?.()('chip-1')
    capturedInteractions.composerClear?.()()
    capturedInteractions.suggestionHover?.()(0)
    capturedInteractions.suggestionSelect?.()(suggestion)
    capturedInteractions.resultHover?.()(0)
    capturedInteractions.resultHover?.()(4)
    capturedInteractions.resultSelect?.()(result)
    capturedInteractions.visiblePrefetch?.()(['process-1', 'process-2'])

    expect(controllerState.open).toHaveBeenCalledTimes(1)
    expect(controllerState.setDraft).toHaveBeenCalledWith('eta:santos')
    expect(controllerState.removeChip).toHaveBeenCalledWith('chip-1')
    expect(controllerState.clearComposer).toHaveBeenCalledTimes(1)
    expect(controllerState.setActiveSuggestionIndex).toHaveBeenCalledWith(0)
    expect(controllerState.acceptSuggestion).toHaveBeenCalledWith(suggestion)
    expect(controllerState.setActiveResultIndex).toHaveBeenNthCalledWith(1, 0)
    expect(controllerState.setActiveResultIndex).toHaveBeenNthCalledWith(2, 4)
    expect(controllerState.prefetchResultIntent).toHaveBeenCalledTimes(1)
    expect(controllerState.prefetchResultIntent).toHaveBeenCalledWith('process-1')
    expect(controllerState.navigateToResult).toHaveBeenCalledWith(result)
    expect(controllerState.prefetchVisibleResults).toHaveBeenCalledWith(['process-1', 'process-2'])
  })
})
