// src/modules/search/ui/SearchOverlay.tsx
//
// Global search overlay component.
// Used both as a visible dashboard search bar and as a Ctrl+K overlay.

import { useNavigate } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js'
import { fetchSearchResults } from '~/modules/search/ui/fetchSearch'
import {
  groupSearchResults,
  type SearchResultGroup,
  type SearchResultType,
  type SearchResultViewModel,
  toSearchViewModels,
} from '~/modules/search/ui/search.viewmodel'
import { useTranslation } from '~/shared/localization/i18n'

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function SearchIcon(): JSX.Element {
  return (
    <svg
      class="h-5 w-5 text-slate-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  )
}

function TypeIcon(props: { type: SearchResultType }): JSX.Element {
  const iconClass = 'h-4 w-4 shrink-0'

  return (
    <Show
      when={props.type === 'container'}
      fallback={
        <Show
          when={props.type === 'process'}
          fallback={
            <Show
              when={props.type === 'carrier'}
              fallback={
                <svg
                  class={`${iconClass} text-slate-400`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              }
            >
              <svg
                class={`${iconClass} text-blue-400`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </Show>
          }
        >
          <svg
            class={`${iconClass} text-blue-500`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </Show>
      }
    >
      <svg
        class={`${iconClass} text-emerald-500`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
        />
      </svg>
    </Show>
  )
}

// ---------------------------------------------------------------------------
// Highlight matching substring
// ---------------------------------------------------------------------------

function HighlightMatch(props: { text: string; query: string }): JSX.Element {
  const parts = () => {
    const q = props.query.toLowerCase()
    const t = props.text
    const idx = t.toLowerCase().indexOf(q)
    if (idx === -1 || q.length === 0) return [{ text: t, highlight: false }]
    return [
      { text: t.slice(0, idx), highlight: false },
      { text: t.slice(idx, idx + q.length), highlight: true },
      { text: t.slice(idx + q.length), highlight: false },
    ].filter((p) => p.text.length > 0)
  }

  return (
    <span>
      <For each={parts()}>
        {(part) => (
          <Show when={part.highlight} fallback={part.text}>
            <mark class="rounded bg-blue-100 px-0.5 text-blue-700">{part.text}</mark>
          </Show>
        )}
      </For>
    </span>
  )
}

// ---------------------------------------------------------------------------
// SearchOverlay Component
// ---------------------------------------------------------------------------

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

  // Flat list of all items for keyboard navigation
  const flatItems = (): readonly SearchResultViewModel[] => {
    const g = groups()
    const flat: SearchResultViewModel[] = []
    for (const group of g) {
      for (const item of group.items) {
        flat.push(item)
      }
    }
    return flat
  }

  // Type label map for group headings
  const typeLabelMap = (): Record<SearchResultType, string> => ({
    process: t(keys.search.groups.processes),
    container: t(keys.search.groups.containers),
    importer: t(keys.search.groups.importers),
    exporter: t(keys.search.groups.exporters),
    carrier: t(keys.search.groups.carriers),
  })

  // --- Open / Close ---
  function open() {
    setIsOpen(true)
    // Focus input on next tick
    setTimeout(() => inputRef?.focus(), 50)
  }

  function close() {
    setIsOpen(false)
    setQuery('')
    setResults([])
    setGroups([])
    setActiveIndex(-1)
  }

  // --- Keyboard shortcut (Ctrl+K / Cmd+K) ---
  function handleGlobalKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      if (isOpen()) {
        close()
      } else {
        open()
      }
    }
    if (e.key === 'Escape' && isOpen()) {
      e.preventDefault()
      close()
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleGlobalKeyDown)
  })

  onCleanup(() => {
    document.removeEventListener('keydown', handleGlobalKeyDown)
    if (debounceTimer) clearTimeout(debounceTimer)
  })

  // --- Debounced search ---
  createEffect(
    on(query, (q) => {
      if (debounceTimer) clearTimeout(debounceTimer)

      if (q.trim().length < 2) {
        setResults([])
        setGroups([])
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      debounceTimer = setTimeout(async () => {
        try {
          const data = await fetchSearchResults(q.trim())
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

  // --- Navigate to result ---
  function navigateToResult(item: SearchResultViewModel) {
    if (item.processId) {
      navigate(`/shipments/${item.processId}`)
    }
    close()
  }

  // --- Keyboard navigation ---
  function handleInputKeyDown(e: KeyboardEvent) {
    const items = flatItems()
    if (items.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const idx = activeIndex()
      if (idx >= 0 && idx < items.length) {
        navigateToResult(items[idx])
      }
    }
  }

  // --- Scroll active item into view ---
  createEffect(
    on(activeIndex, (idx) => {
      if (idx >= 0) {
        const el = document.querySelector(`[data-search-index="${idx}"]`)
        el?.scrollIntoView({ block: 'nearest' })
      }
    }),
  )

  // Track cumulative index for flat keyboard navigation
  function getCumulativeIndex(groupIdx: number, itemIdx: number): number {
    const g = groups()
    let cumulative = 0
    for (let i = 0; i < groupIdx; i++) {
      cumulative += g[i].items.length
    }
    return cumulative + itemIdx
  }

  return (
    <>
      {/* --- Dashboard Search Bar (always visible) --- */}
      <button
        type="button"
        onClick={open}
        class="group flex w-full max-w-2xl items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-left shadow-sm transition-all hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <SearchIcon />
        <span class="flex-1 text-sm text-slate-400">{t(keys.search.placeholder)}</span>
        <kbd class="hidden rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-400 sm:inline-flex">
          Ctrl K
        </kbd>
      </button>

      {/* --- Overlay --- */}
      <Show when={isOpen()}>
        <div
          class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
          style={{ animation: 'search-overlay-in 150ms ease-out' }}
        >
          {/* Backdrop */}
          {/* biome-ignore lint/a11y/useSemanticElements: backdrop overlay uses div as a click-away target, not a true interactive button */}
          <div
            class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={close}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close()
            }}
            role="button"
            tabIndex={-1}
            aria-label={t(keys.search.close)}
          />

          {/* Modal */}
          <div
            class="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            style={{ animation: 'search-modal-in 150ms ease-out' }}
          >
            {/* Input */}
            <div class="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <SearchIcon />
              <input
                ref={inputRef}
                type="text"
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={t(keys.search.placeholder)}
                class="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
                autocomplete="off"
                spellcheck={false}
              />
              <Show when={query().length > 0}>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    inputRef?.focus()
                  }}
                  class="rounded p-0.5 text-slate-400 hover:text-slate-600"
                  aria-label={t(keys.search.clear)}
                >
                  <svg
                    class="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </Show>
              <kbd class="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-400">
                Esc
              </kbd>
            </div>

            {/* Results */}
            <div class="max-h-80 overflow-y-auto">
              {/* Loading */}
              <Show when={isLoading() && query().trim().length >= 2}>
                <div class="px-4 py-6 text-center text-sm text-slate-400">
                  {t(keys.search.loading)}
                </div>
              </Show>

              {/* Empty state */}
              <Show when={!isLoading() && query().trim().length >= 2 && results().length === 0}>
                <div class="px-4 py-6 text-center text-sm text-slate-400">
                  {t(keys.search.noResults)}
                </div>
              </Show>

              {/* Grouped results */}
              <Show when={!isLoading() && groups().length > 0}>
                <For each={groups()}>
                  {(group, groupIdx) => (
                    <div>
                      <div class="bg-slate-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {group.label}
                      </div>
                      <For each={group.items}>
                        {(item, itemIdx) => {
                          const cumulativeIndex = () => getCumulativeIndex(groupIdx(), itemIdx())
                          const isActive = () => activeIndex() === cumulativeIndex()

                          return (
                            <button
                              type="button"
                              data-search-index={cumulativeIndex()}
                              onClick={() => navigateToResult(item)}
                              onMouseEnter={() => setActiveIndex(cumulativeIndex())}
                              class={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                isActive()
                                  ? 'bg-blue-50 text-blue-900'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <TypeIcon type={item.type} />
                              <div class="min-w-0 flex-1">
                                <div class="truncate text-sm font-medium">
                                  <HighlightMatch text={item.title} query={query()} />
                                </div>
                                <Show when={item.subtitle}>
                                  <div class="truncate text-xs text-slate-400">
                                    <HighlightMatch text={item.subtitle ?? ''} query={query()} />
                                  </div>
                                </Show>
                              </div>
                              <Show when={item.carrier}>
                                <span class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                                  {item.carrier}
                                </span>
                              </Show>
                            </button>
                          )
                        }}
                      </For>
                    </div>
                  )}
                </For>
              </Show>

              {/* Hint when empty input */}
              <Show when={query().trim().length < 2 && !isLoading()}>
                <div class="px-4 py-6 text-center text-sm text-slate-400">
                  {t(keys.search.hint)}
                </div>
              </Show>
            </div>

            {/* Footer */}
            <div class="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-400">
              <div class="flex items-center gap-2">
                <kbd class="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs">↑↓</kbd>
                <span>{t(keys.search.footer.navigate)}</span>
              </div>
              <div class="flex items-center gap-2">
                <kbd class="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs">↵</kbd>
                <span>{t(keys.search.footer.select)}</span>
              </div>
              <div class="flex items-center gap-2">
                <kbd class="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs">esc</kbd>
                <span>{t(keys.search.footer.close)}</span>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </>
  )
}
