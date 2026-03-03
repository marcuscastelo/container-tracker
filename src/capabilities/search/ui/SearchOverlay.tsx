import { useNavigate } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, on, onCleanup, onMount } from 'solid-js'
import { fetchSearchResults } from '~/capabilities/search/ui/fetchSearch'
import { SearchOverlayPanel } from '~/capabilities/search/ui/SearchOverlay.panel'
import {
  MIN_SEARCH_QUERY_LENGTH,
  type SearchResultItemVm,
  type SearchUiState,
  toSearchResultItemsVm,
} from '~/capabilities/search/ui/search.vm'

const SEARCH_DEBOUNCE_MS = 180

export function SearchOverlay(): JSX.Element {
  const navigate = useNavigate()

  const [isOpen, setIsOpen] = createSignal(false)
  const [query, setQuery] = createSignal('')
  const [results, setResults] = createSignal<readonly SearchResultItemVm[]>([])
  const [state, setState] = createSignal<SearchUiState>('empty')
  const [activeIndex, setActiveIndex] = createSignal(-1)

  let inputRef: HTMLInputElement | undefined
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let requestSequence = 0
  const normalizedQuery = createMemo(() => query().trim())

  const open = () => {
    setIsOpen(true)
    setTimeout(() => inputRef?.focus(), 50)
  }

  const close = () => {
    setIsOpen(false)
    setQuery('')
    setResults([])
    setState('empty')
    setActiveIndex(-1)
  }

  const handleGlobalKeyDown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault()
      if (isOpen()) {
        close()
      } else {
        open()
      }
    }

    if (event.key === 'Escape' && isOpen()) {
      event.preventDefault()
      close()
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleGlobalKeyDown)
  })

  onCleanup(() => {
    document.removeEventListener('keydown', handleGlobalKeyDown)
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
  })

  createEffect(
    on(normalizedQuery, (currentQuery) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      requestSequence += 1
      const currentRequestSequence = requestSequence

      if (currentQuery.length < MIN_SEARCH_QUERY_LENGTH) {
        setResults([])
        setState('empty')
        setActiveIndex(-1)
        return
      }

      setState('loading')
      debounceTimer = setTimeout(async () => {
        try {
          const data = await fetchSearchResults(currentQuery)
          if (currentRequestSequence !== requestSequence) {
            return
          }

          const viewModels = toSearchResultItemsVm(data)
          setResults(viewModels)
          setActiveIndex(viewModels.length > 0 ? 0 : -1)
          setState(viewModels.length > 0 ? 'ready' : 'empty')
        } catch (err) {
          if (currentRequestSequence !== requestSequence) {
            return
          }

          console.error('Search failed:', err)
          setResults([])
          setActiveIndex(-1)
          setState('error')
        }
      }, SEARCH_DEBOUNCE_MS)
    }),
  )

  const navigateToResult = (item: SearchResultItemVm) => {
    navigate(`/shipments/${item.processId}`)
    close()
  }

  const handleInputKeyDown = (event: KeyboardEvent) => {
    const items = results()
    if (items.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((previous) => (previous < items.length - 1 ? previous + 1 : 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((previous) => (previous > 0 ? previous - 1 : items.length - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const index = activeIndex()
      if (index >= 0 && index < items.length) {
        navigateToResult(items[index])
      }
    }
  }

  createEffect(
    on(activeIndex, (index) => {
      if (index < 0) return
      const element = document.querySelector(`[data-search-index="${index}"]`)
      element?.scrollIntoView({ block: 'nearest' })
    }),
  )

  return (
    <SearchOverlayPanel
      isOpen={isOpen()}
      query={query()}
      state={state()}
      results={results()}
      activeIndex={activeIndex()}
      onOpen={open}
      onClose={close}
      onQueryInput={setQuery}
      onInputKeyDown={handleInputKeyDown}
      onSelectResult={navigateToResult}
      onHoverIndex={setActiveIndex}
      setInputRef={(element) => {
        inputRef = element
      }}
      focusInput={() => inputRef?.focus()}
      minimumQueryLength={MIN_SEARCH_QUERY_LENGTH}
    />
  )
}
