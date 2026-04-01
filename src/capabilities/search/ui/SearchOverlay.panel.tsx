import type { JSX } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { SearchOverlayFooter } from '~/capabilities/search/ui/SearchOverlay.footer'
import { SearchIcon } from '~/capabilities/search/ui/SearchOverlay.icons'
import {
  SearchResultRow,
  type SearchResultRowLabels,
} from '~/capabilities/search/ui/SearchOverlay.result-row'
import { SearchTriggerButton } from '~/capabilities/search/ui/SearchOverlay.trigger'
import type { SearchResultItemVm, SearchUiState } from '~/capabilities/search/ui/search.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { createViewportPrefetchController } from '~/shared/ui/navigation/app-navigation'

// Augment Navigator with User-Agent Client Hints (platform) when available.
declare global {
  type NavigatorUAData = {
    platform?: string
  }

  // biome-ignore lint/style/useConsistentTypeDefinitions: To override the built-in Navigator type, we need to redeclare it as an interface.
  interface Navigator {
    userAgentData?: NavigatorUAData
  }
}

type SearchOverlayPanelProps = {
  readonly isOpen: boolean
  readonly query: string
  readonly state: SearchUiState
  readonly results: readonly SearchResultItemVm[]
  readonly activeIndex: number
  readonly onOpen: () => void
  readonly onClose: () => void
  readonly onQueryInput: (value: string) => void
  readonly onInputKeyDown: (event: KeyboardEvent) => void
  readonly onSelectResult: (item: SearchResultItemVm) => void
  readonly onHoverIndex: (index: number) => void
  readonly onVisibleResultPrefetch: (processIds: readonly string[]) => void
  readonly setInputRef: (element: HTMLInputElement) => void
  readonly focusInput: () => void
  readonly minimumQueryLength: number
}

type SearchPanelTranslation = ReturnType<typeof useTranslation>

type VisibleSearchResultRect = {
  readonly bottom: number
  readonly top: number
}

type VisibleSearchResultRow = {
  readonly dataset: {
    readonly searchProcessId?: string
  }
  readonly getBoundingClientRect: () => VisibleSearchResultRect
}

type VisibleSearchResultContainer = {
  readonly getBoundingClientRect: () => VisibleSearchResultRect
  readonly querySelectorAll: (selector: string) => Iterable<VisibleSearchResultRow>
}

function getMatchSourceLabel(
  source: SearchResultItemVm['matchSource'],
  t: SearchPanelTranslation['t'],
  keys: SearchPanelTranslation['keys'],
): string {
  switch (source) {
    case 'container':
      return t(keys.search.matchSource.container)
    case 'process':
      return t(keys.search.matchSource.process)
    case 'importer':
      return t(keys.search.matchSource.importer)
    case 'bl':
      return t(keys.search.matchSource.bl)
    case 'vessel':
      return t(keys.search.matchSource.vessel)
    case 'status':
      return t(keys.search.matchSource.status)
    case 'carrier':
      return t(keys.search.matchSource.carrier)
  }
}

function getSearchResultRowLabels(
  t: SearchPanelTranslation['t'],
  keys: SearchPanelTranslation['keys'],
): SearchResultRowLabels {
  return {
    processId: t(keys.search.fields.processId),
    importerName: t(keys.search.fields.importerName),
    containers: t(keys.search.fields.containers),
    carrier: t(keys.search.fields.carrier),
    vesselName: t(keys.search.fields.vesselName),
    bl: t(keys.search.fields.bl),
    derivedStatus: t(keys.search.fields.derivedStatus),
    eta: t(keys.search.fields.eta),
  }
}

export function collectVisibleSearchResultProcessIds(
  container: VisibleSearchResultContainer | undefined,
): readonly string[] {
  if (!container) return []

  const containerRect = container.getBoundingClientRect()
  const rows = container.querySelectorAll('[data-search-process-id]')
  const visibleProcessIds: string[] = []

  for (const row of rows) {
    const processId = row.dataset.searchProcessId
    if (!processId) continue

    const rowRect = row.getBoundingClientRect()
    if (rowRect.bottom <= containerRect.top || rowRect.top >= containerRect.bottom) continue

    visibleProcessIds.push(processId)
  }

  return visibleProcessIds
}

export function SearchOverlayPanel(props: SearchOverlayPanelProps): JSX.Element {
  const { t, keys } = useTranslation()
  const [shortcutLabel, setShortcutLabel] = createSignal('Ctrl K')
  let resultsContainerRef: HTMLDivElement | undefined

  const viewportPrefetchController = createViewportPrefetchController({
    collectVisibleKeys: () => collectVisibleSearchResultProcessIds(resultsContainerRef),
    onVisibleKeysSettled: (processIds: readonly string[]) =>
      props.onVisibleResultPrefetch(processIds),
  })

  onMount(() => {
    // Use User-Agent Client Hints when available and fall back to navigator.platform.
    const rawPlatform = navigator.userAgentData?.platform ?? navigator.platform
    const platform = typeof rawPlatform === 'string' ? rawPlatform.toLowerCase() : ''
    const userAgent =
      typeof navigator.userAgent === 'string' ? navigator.userAgent.toLowerCase() : ''
    const isApplePlatform =
      platform.includes('mac') ||
      platform.includes('iphone') ||
      platform.includes('ipad') ||
      platform.includes('ipod') ||
      userAgent.includes('mac os') ||
      userAgent.includes('iphone') ||
      userAgent.includes('ipad')

    setShortcutLabel(isApplePlatform ? '⌘K' : 'Ctrl K')
  })

  createEffect(() => {
    const results = props.results
    if (!props.isOpen || props.state !== 'ready' || results.length === 0) return

    viewportPrefetchController.schedule()
  })

  createEffect(() => {
    const resultsContainer = resultsContainerRef
    if (!props.isOpen || !resultsContainer) return

    const scheduleVisiblePrefetch = () => {
      viewportPrefetchController.schedule()
    }

    resultsContainer.addEventListener('scroll', scheduleVisiblePrefetch, { passive: true })
    window.addEventListener('resize', scheduleVisiblePrefetch)

    onCleanup(() => {
      resultsContainer.removeEventListener('scroll', scheduleVisiblePrefetch)
      window.removeEventListener('resize', scheduleVisiblePrefetch)
      viewportPrefetchController.dispose()
    })
  })

  const shouldShowResultsState = () => props.query.trim().length >= props.minimumQueryLength
  const showShortQueryHint = () => !shouldShowResultsState()
  const fallbackText = t(keys.search.notAvailable)
  const labels = getSearchResultRowLabels(t, keys)

  return (
    <>
      <SearchTriggerButton
        placeholder={t(keys.search.placeholder)}
        shortcutLabel={shortcutLabel()}
        onOpen={() => props.onOpen()}
      />

      <Show when={props.isOpen}>
        <div
          class="fixed inset-0 z-50 flex items-start justify-center px-2 pt-[8vh] sm:px-4"
          style={{ animation: 'search-overlay-in 150ms ease-out' }}
        >
          {/* biome-ignore lint/a11y/useSemanticElements: backdrop overlay uses div as a click-away target, not a true interactive button */}
          <div
            class="absolute inset-0 bg-ring/60 backdrop-blur-sm"
            onClick={() => props.onClose()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') props.onClose()
            }}
            role="button"
            tabIndex={-1}
            aria-label={t(keys.search.close)}
          />

          <div
            class="relative z-10 w-full max-w-4xl overflow-hidden rounded-xl border border-control-border bg-control-popover shadow-2xl"
            style={{ animation: 'search-modal-in 150ms ease-out' }}
            role="dialog"
            aria-modal="true"
            aria-label={t(keys.search.placeholder)}
          >
            <div class="flex items-center gap-3 border-b border-control-border px-4 py-3">
              <SearchIcon />
              <input
                ref={(element) => props.setInputRef(element)}
                type="text"
                value={props.query}
                onInput={(event) => props.onQueryInput(event.currentTarget.value)}
                onKeyDown={(event) => props.onInputKeyDown(event)}
                placeholder={t(keys.search.placeholder)}
                class="flex-1 bg-transparent text-sm-ui text-control-popover-foreground placeholder:text-control-placeholder outline-none"
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
                  class="rounded p-0.5 text-control-foreground hover:text-control-foreground-strong"
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
              <kbd class="rounded border border-control-border bg-control-bg-hover px-1.5 py-0.5 text-xs-ui text-control-foreground">
                Esc
              </kbd>
            </div>

            <div
              ref={(element) => {
                resultsContainerRef = element
              }}
              class="max-h-[65vh] overflow-y-auto"
            >
              <Show when={props.state === 'loading' && shouldShowResultsState()}>
                <div class="px-4 py-6 text-center text-sm-ui text-text-muted" />
              </Show>

              <Show when={props.state === 'error' && shouldShowResultsState()}>
                <div class="px-4 py-6 text-center text-sm-ui text-tone-danger-fg">
                  {t(keys.search.error)}
                </div>
              </Show>

              <Show when={props.state === 'empty' && shouldShowResultsState()}>
                <div class="px-4 py-6 text-center text-sm-ui text-text-muted">
                  {t(keys.search.noResults)}
                </div>
              </Show>

              <Show when={showShortQueryHint() && props.state !== 'loading'}>
                <div class="px-4 py-6 text-center text-sm-ui text-text-muted">
                  {t(keys.search.hint, { count: props.minimumQueryLength })}
                </div>
              </Show>

              <Show when={props.state === 'ready' && props.results.length > 0}>
                <For each={props.results}>
                  {(item, itemIndex) => (
                    <SearchResultRow
                      item={item}
                      index={itemIndex()}
                      activeIndex={props.activeIndex}
                      labels={labels}
                      fallbackText={fallbackText}
                      matchSourceLabel={getMatchSourceLabel(item.matchSource, t, keys)}
                      onSelectResult={props.onSelectResult}
                      onHoverIndex={props.onHoverIndex}
                    />
                  )}
                </For>
              </Show>
            </div>

            <SearchOverlayFooter
              navigateLabel={t(keys.search.footer.navigate)}
              selectLabel={t(keys.search.footer.select)}
              closeLabel={t(keys.search.footer.close)}
            />
          </div>
        </div>
      </Show>
    </>
  )
}
