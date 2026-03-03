import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type {
  SearchResultGroup,
  SearchResultType,
  SearchResultViewModel,
} from '~/capabilities/search/ui/search.viewmodel'
import { useTranslation } from '~/shared/localization/i18n'

type SearchOverlayPanelProps = {
  readonly isOpen: boolean
  readonly query: string
  readonly isLoading: boolean
  readonly results: readonly SearchResultViewModel[]
  readonly groups: readonly SearchResultGroup[]
  readonly activeIndex: number
  readonly onOpen: () => void
  readonly onClose: () => void
  readonly onQueryInput: (value: string) => void
  readonly onInputKeyDown: (event: KeyboardEvent) => void
  readonly onSelectResult: (item: SearchResultViewModel) => void
  readonly onHoverIndex: (index: number) => void
  readonly getCumulativeIndex: (groupIndex: number, itemIndex: number) => number
  readonly setInputRef: (element: HTMLInputElement) => void
  readonly focusInput: () => void
}

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

function TypeIcon(props: { readonly type: SearchResultType }): JSX.Element {
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

function HighlightMatch(props: { readonly text: string; readonly query: string }): JSX.Element {
  const parts = () => {
    const query = props.query.toLowerCase()
    const text = props.text
    const index = text.toLowerCase().indexOf(query)
    if (index === -1 || query.length === 0) return [{ text, highlight: false }]
    return [
      { text: text.slice(0, index), highlight: false },
      { text: text.slice(index, index + query.length), highlight: true },
      { text: text.slice(index + query.length), highlight: false },
    ].filter((part) => part.text.length > 0)
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

export function SearchOverlayPanel(props: SearchOverlayPanelProps): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <>
      <button
        type="button"
        onClick={() => props.onOpen()}
        class="group flex w-full max-w-xl items-center gap-2.5 rounded border border-slate-200 bg-white px-3 py-1.5 text-left shadow-sm transition-all hover:border-slate-300 hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
      >
        <SearchIcon />
        <span class="flex-1 text-[13px] text-slate-400">{t(keys.search.placeholder)}</span>
        <kbd class="hidden items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 sm:inline-flex">
          <span class="text-[9px]">⌘</span>K
        </kbd>
      </button>

      <Show when={props.isOpen}>
        <div
          class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
          style={{ animation: 'search-overlay-in 150ms ease-out' }}
        >
          {/* biome-ignore lint/a11y/useSemanticElements: backdrop overlay uses div as a click-away target, not a true interactive button */}
          <div
            class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => props.onClose()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') props.onClose()
            }}
            role="button"
            tabIndex={-1}
            aria-label={t(keys.search.close)}
          />

          <div
            class="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            style={{ animation: 'search-modal-in 150ms ease-out' }}
          >
            <div class="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <SearchIcon />
              <input
                ref={(element) => props.setInputRef(element)}
                type="text"
                value={props.query}
                onInput={(event) => props.onQueryInput(event.currentTarget.value)}
                onKeyDown={(event) => props.onInputKeyDown(event)}
                placeholder={t(keys.search.placeholder)}
                class="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
                autocomplete="off"
                spellcheck={false}
              />
              <Show when={props.query.length > 0}>
                <button
                  type="button"
                  onClick={() => {
                    props.onQueryInput('')
                    props.focusInput()
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

            <div class="max-h-80 overflow-y-auto">
              <Show when={props.isLoading && props.query.trim().length >= 2}>
                <div class="px-4 py-6 text-center text-sm text-slate-400">
                  {t(keys.search.loading)}
                </div>
              </Show>

              <Show
                when={
                  !props.isLoading && props.query.trim().length >= 2 && props.results.length === 0
                }
              >
                <div class="px-4 py-6 text-center text-sm text-slate-400">
                  {t(keys.search.noResults)}
                </div>
              </Show>

              <Show when={!props.isLoading && props.groups.length > 0}>
                <For each={props.groups}>
                  {(group, groupIndex) => (
                    <div>
                      <div class="bg-slate-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {group.label}
                      </div>
                      <For each={group.items}>
                        {(item, itemIndex) => {
                          const cumulativeIndex = () =>
                            props.getCumulativeIndex(groupIndex(), itemIndex())
                          const isActive = () => props.activeIndex === cumulativeIndex()

                          return (
                            <button
                              type="button"
                              data-search-index={cumulativeIndex()}
                              onClick={() => props.onSelectResult(item)}
                              onMouseEnter={() => props.onHoverIndex(cumulativeIndex())}
                              class={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                isActive()
                                  ? 'bg-blue-50 text-blue-900'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <TypeIcon type={item.type} />
                              <div class="min-w-0 flex-1">
                                <div class="truncate text-sm font-medium">
                                  <HighlightMatch text={item.title} query={props.query} />
                                </div>
                                <Show when={item.subtitle}>
                                  <div class="truncate text-xs text-slate-400">
                                    <HighlightMatch
                                      text={item.subtitle ?? ''}
                                      query={props.query}
                                    />
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

              <Show when={props.query.trim().length < 2 && !props.isLoading}>
                <div class="px-4 py-6 text-center text-sm text-slate-400">
                  {t(keys.search.hint)}
                </div>
              </Show>
            </div>

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
