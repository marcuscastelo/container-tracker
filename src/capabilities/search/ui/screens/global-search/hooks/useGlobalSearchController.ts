import { useNavigate, usePreloadRoute } from '@solidjs/router'
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  onMount,
  type Setter,
} from 'solid-js'
import {
  formatSearchComposerChip,
  type SearchComposerChip,
  tryParseDraftFilterToken,
} from '~/capabilities/search/ui/screens/global-search/lib/searchTokenizeInput.service'
import {
  toGlobalSearchFilterChipVm,
  toGlobalSearchResponseVm,
  toGlobalSearchSuggestionsVm,
} from '~/capabilities/search/ui/screens/global-search/mappers/globalSearch.ui-mapper'
import type {
  GlobalSearchResultItemVM,
  GlobalSearchSuggestionVM,
  GlobalSearchUiState,
} from '~/capabilities/search/ui/screens/global-search/types/global-search.vm'
import { fetchGlobalSearchResults } from '~/capabilities/search/ui/screens/global-search/usecases/fetchGlobalSearchResults.usecase'
import { fetchGlobalSearchSuggestions } from '~/capabilities/search/ui/screens/global-search/usecases/fetchGlobalSearchSuggestions.usecase'
import { prefetchProcessDetail } from '~/modules/process/ui/fetchProcess'
import { type TranslationApi, useTranslation } from '~/shared/localization/i18n'
import {
  navigateToProcess,
  scheduleIntentPrefetch,
  scheduleVisiblePrefetch,
} from '~/shared/ui/navigation/app-navigation'

const SEARCH_DEBOUNCE_MS = 180
const SUGGESTIONS_DEBOUNCE_MS = 120

type SearchRequestTimers = {
  searchDebounceTimer: ReturnType<typeof setTimeout> | undefined
  suggestionsDebounceTimer: ReturnType<typeof setTimeout> | undefined
  searchSequence: number
  suggestionsSequence: number
}

function upsertChip(
  current: readonly SearchComposerChip[],
  candidate: SearchComposerChip,
): readonly SearchComposerChip[] {
  return [...current.filter((chip) => chip.key !== candidate.key), candidate]
}

function shouldAutoHighlightSuggestion(
  draft: string,
  suggestions: readonly GlobalSearchSuggestionVM[],
): boolean {
  const normalizedDraft = draft.trim()
  if (suggestions.length === 0) return false
  if (normalizedDraft.length === 0) return true
  if (normalizedDraft.includes(':')) return true
  return normalizedDraft.length <= 4
}

function focusInputElement(inputRef: HTMLInputElement | undefined): void {
  inputRef?.focus()
}

function useBodyScrollLock(isOpen: Accessor<boolean>): void {
  createEffect(
    on(isOpen, (openValue) => {
      if (!openValue) return

      const previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'

      onCleanup(() => {
        document.body.style.overflow = previousOverflow
      })
    }),
  )
}

function useActiveResultScrollEffect(activeResultIndex: Accessor<number>): void {
  createEffect(
    on(activeResultIndex, (index) => {
      if (index < 0) return
      const element = document.querySelector(`[data-search-index="${index}"]`)
      element?.scrollIntoView({ block: 'nearest' })
    }),
  )
}

function createAcceptSuggestionHandler(command: {
  readonly setDraft: Setter<string>
  readonly setActiveSuggestionIndex: Setter<number>
  readonly addChip: (candidate: SearchComposerChip) => void
  readonly focusInput: () => void
}) {
  return (suggestion: GlobalSearchSuggestionVM): void => {
    if (suggestion.kind === 'field' && suggestion.fieldKey !== null) {
      command.setDraft(`${suggestion.fieldKey}:`)
      command.setActiveSuggestionIndex(0)
      command.focusInput()
      return
    }

    if (suggestion.kind === 'value' && suggestion.fieldKey !== null && suggestion.value !== null) {
      const chip = tryParseDraftFilterToken(`${suggestion.fieldKey}:${suggestion.value}`)
      if (chip !== null) {
        command.addChip(chip)
      }
      return
    }

    command.setDraft(suggestion.insertText)
    command.setActiveSuggestionIndex(-1)
    command.focusInput()
  }
}

function createComposerKeyDownHandler(command: {
  readonly suggestions: Accessor<readonly GlobalSearchSuggestionVM[]>
  readonly results: Accessor<readonly GlobalSearchResultItemVM[]>
  readonly activeSuggestionIndex: Accessor<number>
  readonly activeResultIndex: Accessor<number>
  readonly showSuggestions: Accessor<boolean>
  readonly draft: Accessor<string>
  readonly chips: Accessor<readonly SearchComposerChip[]>
  readonly setActiveSuggestionIndex: Setter<number>
  readonly setActiveResultIndex: Setter<number>
  readonly acceptSuggestion: (suggestion: GlobalSearchSuggestionVM) => void
  readonly addChip: (candidate: SearchComposerChip) => void
  readonly editLastChip: () => void
  readonly navigateToResult: (item: GlobalSearchResultItemVM) => void
  readonly close: () => void
}) {
  return (event: KeyboardEvent): void => {
    const currentSuggestions = command.suggestions()
    const currentResults = command.results()

    if (event.key === 'ArrowDown') {
      event.preventDefault()

      if (command.showSuggestions() && currentSuggestions.length > 0) {
        command.setActiveSuggestionIndex((current) =>
          current < currentSuggestions.length - 1 ? current + 1 : 0,
        )
        return
      }

      if (currentResults.length > 0) {
        command.setActiveResultIndex((current) =>
          current < currentResults.length - 1 ? current + 1 : 0,
        )
      }
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()

      if (command.showSuggestions() && currentSuggestions.length > 0) {
        command.setActiveSuggestionIndex((current) =>
          current > 0 ? current - 1 : currentSuggestions.length - 1,
        )
        return
      }

      if (currentResults.length > 0) {
        command.setActiveResultIndex((current) =>
          current > 0 ? current - 1 : currentResults.length - 1,
        )
      }
      return
    }

    if (event.key === 'Tab') {
      const suggestion = currentSuggestions[command.activeSuggestionIndex()]
      if (suggestion !== undefined) {
        event.preventDefault()
        command.acceptSuggestion(suggestion)
      }
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()

      const suggestion = currentSuggestions[command.activeSuggestionIndex()]
      if (suggestion !== undefined) {
        command.acceptSuggestion(suggestion)
        return
      }

      const draftFilter = tryParseDraftFilterToken(command.draft())
      if (draftFilter !== null) {
        command.addChip(draftFilter)
        return
      }

      const activeResult = currentResults[command.activeResultIndex()]
      if (activeResult !== undefined) {
        command.navigateToResult(activeResult)
      }
      return
    }

    if (event.key === 'Backspace' && command.draft().length === 0 && command.chips().length > 0) {
      event.preventDefault()
      command.editLastChip()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      command.close()
    }
  }
}

function createGlobalKeyDownHandler(command: {
  readonly isOpen: Accessor<boolean>
  readonly open: () => void
  readonly close: () => void
}) {
  return (event: KeyboardEvent): void => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault()
      if (command.isOpen()) {
        command.close()
      } else {
        command.open()
      }
      return
    }

    if (event.key === 'Escape' && command.isOpen()) {
      event.preventDefault()
      command.close()
    }
  }
}

function useSearchResultsEffect(command: {
  readonly isOpen: Accessor<boolean>
  readonly draft: Accessor<string>
  readonly serializedFilters: Accessor<readonly string[]>
  readonly translation: TranslationApi
  readonly timers: SearchRequestTimers
  readonly setResults: Setter<readonly GlobalSearchResultItemVM[]>
  readonly setUiState: Setter<GlobalSearchUiState>
  readonly setEmptyTitle: Setter<string>
  readonly setEmptyDescription: Setter<string>
  readonly setEmptyExamples: Setter<readonly string[]>
  readonly setActiveResultIndex: Setter<number>
}): void {
  createEffect(
    on(
      [command.isOpen, command.draft, command.serializedFilters],
      ([openValue, currentDraft, currentFilters]) => {
        if (command.timers.searchDebounceTimer !== undefined) {
          clearTimeout(command.timers.searchDebounceTimer)
        }

        if (!openValue) return

        command.timers.searchSequence += 1
        const currentSequence = command.timers.searchSequence

        if (currentDraft.trim().length === 0 && currentFilters.length === 0) {
          command.setResults([])
          command.setUiState('empty')
          command.setActiveResultIndex(-1)
          return
        }

        command.setUiState('loading')
        command.timers.searchDebounceTimer = setTimeout(async () => {
          try {
            const response = await fetchGlobalSearchResults({
              query: currentDraft,
              filters: currentFilters,
            })

            if (currentSequence !== command.timers.searchSequence) return

            const viewModel = toGlobalSearchResponseVm(response, command.translation)
            command.setResults(viewModel.items)
            command.setEmptyTitle(viewModel.emptyTitle)
            command.setEmptyDescription(viewModel.emptyDescription)
            command.setEmptyExamples(viewModel.emptyExamples)
            command.setActiveResultIndex(viewModel.items.length > 0 ? 0 : -1)
            command.setUiState(viewModel.items.length > 0 ? 'ready' : 'empty')
          } catch (error) {
            if (currentSequence !== command.timers.searchSequence) return

            console.error('Global search failed:', error)
            command.setResults([])
            command.setActiveResultIndex(-1)
            command.setUiState('error')
          }
        }, SEARCH_DEBOUNCE_MS)
      },
    ),
  )
}

function useSuggestionsEffect(command: {
  readonly isOpen: Accessor<boolean>
  readonly draft: Accessor<string>
  readonly serializedFilters: Accessor<readonly string[]>
  readonly translation: TranslationApi
  readonly timers: SearchRequestTimers
  readonly setSuggestions: Setter<readonly GlobalSearchSuggestionVM[]>
  readonly setActiveSuggestionIndex: Setter<number>
}): void {
  createEffect(
    on(
      [command.isOpen, command.draft, command.serializedFilters],
      ([openValue, currentDraft, currentFilters]) => {
        if (command.timers.suggestionsDebounceTimer !== undefined) {
          clearTimeout(command.timers.suggestionsDebounceTimer)
        }

        if (!openValue) return

        command.timers.suggestionsSequence += 1
        const currentSequence = command.timers.suggestionsSequence

        command.timers.suggestionsDebounceTimer = setTimeout(async () => {
          try {
            const response = await fetchGlobalSearchSuggestions({
              query: currentDraft,
              filters: currentFilters,
            })

            if (currentSequence !== command.timers.suggestionsSequence) return

            const suggestionViewModels = toGlobalSearchSuggestionsVm(response, command.translation)
            command.setSuggestions(suggestionViewModels)
            command.setActiveSuggestionIndex(
              shouldAutoHighlightSuggestion(currentDraft, suggestionViewModels) ? 0 : -1,
            )
          } catch (error) {
            if (currentSequence !== command.timers.suggestionsSequence) return

            console.error('Global search suggestions failed:', error)
            command.setSuggestions([])
            command.setActiveSuggestionIndex(-1)
          }
        }, SUGGESTIONS_DEBOUNCE_MS)
      },
    ),
  )
}

export function useGlobalSearchController() {
  const translation = useTranslation()
  const navigate = useNavigate()
  const preloadRoute = usePreloadRoute()

  const [isOpen, setIsOpen] = createSignal(false)
  const [draft, setDraft] = createSignal('')
  const [chips, setChips] = createSignal<readonly SearchComposerChip[]>([])
  const [results, setResults] = createSignal<readonly GlobalSearchResultItemVM[]>([])
  const [suggestions, setSuggestions] = createSignal<readonly GlobalSearchSuggestionVM[]>([])
  const [uiState, setUiState] = createSignal<GlobalSearchUiState>('empty')
  const [activeResultIndex, setActiveResultIndex] = createSignal(-1)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = createSignal(-1)
  const [emptyTitle, setEmptyTitle] = createSignal('')
  const [emptyDescription, setEmptyDescription] = createSignal('')
  const [emptyExamples, setEmptyExamples] = createSignal<readonly string[]>([])

  let inputRef: HTMLInputElement | undefined
  const timers: SearchRequestTimers = {
    searchDebounceTimer: undefined,
    suggestionsDebounceTimer: undefined,
    searchSequence: 0,
    suggestionsSequence: 0,
  }

  const serializedFilters = createMemo(() => chips().map((chip) => formatSearchComposerChip(chip)))
  const chipViewModels = createMemo(() =>
    chips().map((chip) => toGlobalSearchFilterChipVm(translation, chip.key, chip.value)),
  )
  const showSuggestions = createMemo(
    () =>
      suggestions().length > 0 &&
      (draft().trim().length === 0 ||
        draft().includes(':') ||
        activeSuggestionIndex() >= 0 ||
        results().length === 0),
  )

  const focusInput = () => {
    focusInputElement(inputRef)
  }

  const open = () => {
    setIsOpen(true)
    setTimeout(() => focusInput(), 50)
  }

  const close = () => {
    setIsOpen(false)
    setDraft('')
    setChips([])
    setResults([])
    setSuggestions([])
    setUiState('empty')
    setActiveResultIndex(-1)
    setActiveSuggestionIndex(-1)
    setEmptyExamples([])
    setEmptyTitle('')
    setEmptyDescription('')
  }

  const prefetchResultIntent = (processId: string) => {
    scheduleIntentPrefetch({
      processId,
      preloadRoute,
      preloadData: (prefetchedProcessId) =>
        prefetchProcessDetail(prefetchedProcessId, translation.locale()),
    })
  }

  const prefetchVisibleResults = (processIds: readonly string[]) => {
    scheduleVisiblePrefetch({
      processIds,
      preloadRoute,
      preloadData: (prefetchedProcessId) =>
        prefetchProcessDetail(prefetchedProcessId, translation.locale()),
    })
  }

  const navigateToResult = (item: GlobalSearchResultItemVM) => {
    prefetchResultIntent(item.processId)
    navigateToProcess({
      navigate,
      processId: item.processId,
    })
    close()
  }

  const addChip = (candidate: SearchComposerChip) => {
    setChips((current) => upsertChip(current, candidate))
    setDraft('')
    setActiveSuggestionIndex(-1)
    focusInput()
  }

  const removeChip = (index: number) => {
    setChips((current) => current.filter((_, currentIndex) => currentIndex !== index))
    focusInput()
  }

  const editLastChip = () => {
    const currentChips = chips()
    const lastChip = currentChips[currentChips.length - 1]
    if (lastChip === undefined) return

    setChips(currentChips.slice(0, currentChips.length - 1))
    setDraft(formatSearchComposerChip(lastChip))
    setActiveSuggestionIndex(-1)
    focusInput()
  }

  const acceptSuggestion = createAcceptSuggestionHandler({
    setDraft,
    setActiveSuggestionIndex,
    addChip,
    focusInput,
  })

  const handleComposerKeyDown = createComposerKeyDownHandler({
    suggestions,
    results,
    activeSuggestionIndex,
    activeResultIndex,
    showSuggestions,
    draft,
    chips,
    setActiveSuggestionIndex,
    setActiveResultIndex,
    acceptSuggestion,
    addChip,
    editLastChip,
    navigateToResult,
    close,
  })

  const handleGlobalKeyDown = createGlobalKeyDownHandler({
    isOpen,
    open,
    close,
  })

  onMount(() => {
    document.addEventListener('keydown', handleGlobalKeyDown)
  })

  onCleanup(() => {
    document.removeEventListener('keydown', handleGlobalKeyDown)

    if (timers.searchDebounceTimer !== undefined) {
      clearTimeout(timers.searchDebounceTimer)
    }

    if (timers.suggestionsDebounceTimer !== undefined) {
      clearTimeout(timers.suggestionsDebounceTimer)
    }
  })

  useBodyScrollLock(isOpen)
  useSearchResultsEffect({
    isOpen,
    draft,
    serializedFilters,
    translation,
    timers,
    setResults,
    setUiState,
    setEmptyTitle,
    setEmptyDescription,
    setEmptyExamples,
    setActiveResultIndex,
  })
  useSuggestionsEffect({
    isOpen,
    draft,
    serializedFilters,
    translation,
    timers,
    setSuggestions,
    setActiveSuggestionIndex,
  })
  useActiveResultScrollEffect(activeResultIndex)

  return {
    isOpen,
    draft,
    chips: chipViewModels,
    results,
    suggestions,
    uiState,
    activeResultIndex,
    activeSuggestionIndex,
    emptyTitle,
    emptyDescription,
    emptyExamples,
    open,
    close,
    focusInput,
    setDraft,
    setInputRef: (element: HTMLInputElement) => {
      inputRef = element
    },
    removeChip,
    clearComposer: () => {
      setDraft('')
      setChips([])
      focusInput()
    },
    acceptSuggestion,
    handleComposerKeyDown,
    navigateToResult,
    prefetchVisibleResults,
    prefetchResultIntent,
    setActiveResultIndex,
    setActiveSuggestionIndex,
    showSuggestions,
  }
}
