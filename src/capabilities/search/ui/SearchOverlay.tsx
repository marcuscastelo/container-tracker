import { useNavigate } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createEffect, createSignal, on, onCleanup, onMount } from 'solid-js'
import { fetchSearchResults } from '~/capabilities/search/ui/fetchSearch'
import { SearchOverlayPanel } from '~/capabilities/search/ui/SearchOverlay.panel'
import {
  groupSearchResults,
  type SearchResultGroup,
  type SearchResultType,
  type SearchResultViewModel,
  toSearchViewModels,
} from '~/capabilities/search/ui/search.viewmodel'
import { useTranslation } from '~/shared/localization/i18n'

export function SearchOverlay(): JSX.Element {
  const { t, keys } = useTranslation()
  const navigate = useNavigate()

  const [isOpen, setIsOpen] = createSignal(false)
  const [query, setQuery] = createSignal('')
  const [results, setResults] = createSignal<readonly SearchResultViewModel[]>([])
  const [groups, setGroups] = createSignal<readonly SearchResultGroup[]>([])
  const [isLoading, setIsLoading] = createSignal(false)
  const [activeIndex, setActiveIndex] = createSignal(-1)

  let inputRef: HTMLInputElement | undefined
  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  const flatItems = (): readonly SearchResultViewModel[] => {
    const grouped = groups()
    const flattened: SearchResultViewModel[] = []
    for (const group of grouped) {
      for (const item of group.items) {
        flattened.push(item)
      }
    }
    return flattened
  }

  const typeLabelMap = (): Record<SearchResultType, string> => ({
    process: t(keys.search.groups.processes),
    container: t(keys.search.groups.containers),
    importer: t(keys.search.groups.importers),
    exporter: t(keys.search.groups.exporters),
    carrier: t(keys.search.groups.carriers),
  })

  const open = () => {
    setIsOpen(true)
    setTimeout(() => inputRef?.focus(), 50)
  }

  const close = () => {
    setIsOpen(false)
    setQuery('')
    setResults([])
    setGroups([])
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
    on(query, (currentQuery) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      if (currentQuery.trim().length < 2) {
        setResults([])
        setGroups([])
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      debounceTimer = setTimeout(async () => {
        try {
          const data = await fetchSearchResults(currentQuery.trim())
          const viewModels = toSearchViewModels(data)
          setResults(viewModels)
          setGroups(groupSearchResults(viewModels, typeLabelMap()))
          setActiveIndex(viewModels.length > 0 ? 0 : -1)
        } catch (err) {
          console.error('Search failed:', err)
          setResults([])
          setGroups([])
        } finally {
          setIsLoading(false)
        }
      }, 150)
    }),
  )

  const navigateToResult = (item: SearchResultViewModel) => {
    if (item.processId) {
      navigate(`/shipments/${item.processId}`)
    }
    close()
  }

  const handleInputKeyDown = (event: KeyboardEvent) => {
    const items = flatItems()
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

  const getCumulativeIndex = (groupIndex: number, itemIndex: number): number => {
    const grouped = groups()
    let cumulative = 0
    for (let index = 0; index < groupIndex; index += 1) {
      cumulative += grouped[index].items.length
    }
    return cumulative + itemIndex
  }

  return (
    <SearchOverlayPanel
      isOpen={isOpen()}
      query={query()}
      isLoading={isLoading()}
      results={results()}
      groups={groups()}
      activeIndex={activeIndex()}
      onOpen={open}
      onClose={close}
      onQueryInput={setQuery}
      onInputKeyDown={handleInputKeyDown}
      onSelectResult={navigateToResult}
      onHoverIndex={setActiveIndex}
      getCumulativeIndex={getCumulativeIndex}
      setInputRef={(element) => {
        inputRef = element
      }}
      focusInput={() => inputRef?.focus()}
    />
  )
}
