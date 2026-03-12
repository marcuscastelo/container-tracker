import type { JSX } from 'solid-js'
import { createSignal, For, onMount, Show } from 'solid-js'
import type { SearchResultItemVm, SearchUiState } from '~/capabilities/search/ui/search.vm'
import { useTranslation } from '~/shared/localization/i18n'

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
  readonly setInputRef: (element: HTMLInputElement) => void
  readonly focusInput: () => void
  readonly minimumQueryLength: number
}

type SearchTriggerButtonProps = {
  readonly placeholder: string
  readonly shortcutLabel: string
  readonly onOpen: () => void
}

function SearchTriggerButton(props: SearchTriggerButtonProps): JSX.Element {
  const [isFocused, setIsFocused] = createSignal(false)

  return (
    <button
      type="button"
      data-search-trigger="true"
      onClick={() => props.onOpen()}
      onFocusIn={() => setIsFocused(true)}
      onFocusOut={() => setIsFocused(false)}
      class="group relative flex w-full items-center gap-2 rounded-md border border-control-border bg-control-bg px-3 pr-12 text-left transition-colors hover:border-control-border-hover hover:bg-control-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      style={{ height: 'var(--dashboard-search-height)' }}
    >
      <SearchIcon />
      <span class="flex-1 truncate text-sm-ui text-control-foreground">{props.placeholder}</span>
      <span
        class={`pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 transition-opacity sm:inline-block ${
          isFocused() ? 'opacity-0' : 'opacity-80'
        }`}
        aria-hidden="true"
      >
        <kbd class="rounded border border-border bg-surface-muted/50 px-1.5 py-0.5 font-mono text-xs-ui text-text-muted">
          {props.shortcutLabel}
        </kbd>
      </span>
    </button>
  )
}

function SearchIcon(): JSX.Element {
  return (
    <svg
      class="h-4 w-4 text-control-foreground"
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

function MatchSourceIcon(props: {
  readonly source: SearchResultItemVm['matchSource']
}): JSX.Element {
  const className = 'h-4 w-4 shrink-0'

  return (
    <Show
      when={props.source === 'container'}
      fallback={
        <Show
          when={props.source === 'process'}
          fallback={
            <Show
              when={
                props.source === 'importer' || props.source === 'bl' || props.source === 'carrier'
              }
              fallback={
                <Show
                  when={props.source === 'vessel'}
                  fallback={
                    <svg
                      class={`${className} text-tone-info-strong`}
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
                  }
                >
                  <svg
                    class={`${className} text-tone-info-fg`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M3 17l3-3m0 0l4 4 8-8m-8 8V6"
                    />
                  </svg>
                </Show>
              }
            >
              <svg
                class={`${className} text-text-muted`}
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
            </Show>
          }
        >
          <svg
            class={`${className} text-tone-info-fg`}
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
        class={`${className} text-tone-success-fg`}
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

function formatNullableText(value: string | null, fallbackText: string): string {
  if (value === null) return fallbackText

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallbackText
}

function formatContainers(value: readonly string[], fallbackText: string): string {
  if (value.length === 0) return fallbackText
  return value.join(', ')
}

function formatEta(value: string | null, fallbackText: string): string {
  if (value === null) return fallbackText

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(parsed)
}

type SearchResultRowLabels = {
  readonly processId: string
  readonly importerName: string
  readonly containers: string
  readonly carrier: string
  readonly vesselName: string
  readonly bl: string
  readonly derivedStatus: string
  readonly eta: string
}

type SearchResultRowProps = {
  readonly item: SearchResultItemVm
  readonly index: number
  readonly activeIndex: number
  readonly fallbackText: string
  readonly labels: SearchResultRowLabels
  readonly matchSourceLabel: string
  readonly onSelectResult: (item: SearchResultItemVm) => void
  readonly onHoverIndex: (index: number) => void
}

function SearchResultRow(props: SearchResultRowProps): JSX.Element {
  const isActive = () => props.activeIndex === props.index

  return (
    <button
      type="button"
      data-search-index={props.index}
      onClick={() => props.onSelectResult(props.item)}
      onMouseEnter={() => props.onHoverIndex(props.index)}
      class={`flex h-auto w-full flex-col border-b border-control-border px-4 py-3 text-left transition-colors last:border-b-0 ${
        isActive()
          ? 'bg-control-selected-bg text-control-selected-foreground'
          : 'bg-control-popover text-control-popover-foreground hover:bg-control-bg-hover'
      }`}
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-start gap-2">
            <MatchSourceIcon source={props.item.matchSource} />
            <span class="truncate text-sm-ui font-semibold">
              {formatNullableText(props.item.processReference, props.item.processId)}
            </span>
          </div>
          <div class="mt-1 text-xs-ui text-text-muted">
            {props.labels.processId}: {props.item.processId}
          </div>
        </div>

        <span class="shrink-0 self-start rounded bg-control-bg-hover px-2 py-0.5 text-xs-ui font-medium text-control-foreground">
          {props.matchSourceLabel}
        </span>
      </div>

      <div class="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs-ui text-control-popover-foreground">
        <div class="min-w-0 truncate">
          <span class="font-medium text-text-muted">{props.labels.importerName}:</span>{' '}
          {formatNullableText(props.item.importerName, props.fallbackText)}
        </div>
        <div class="min-w-0 truncate">
          <span class="font-medium text-text-muted">{props.labels.containers}:</span>{' '}
          {formatContainers(props.item.containers, props.fallbackText)}
        </div>
        <div class="min-w-0 truncate">
          <span class="font-medium text-text-muted">{props.labels.carrier}:</span>{' '}
          {formatNullableText(props.item.carrier, props.fallbackText)}
        </div>
        <div class="min-w-0 truncate">
          <span class="font-medium text-text-muted">{props.labels.vesselName}:</span>{' '}
          {formatNullableText(props.item.vesselName, props.fallbackText)}
        </div>
        <div class="min-w-0 truncate">
          <span class="font-medium text-text-muted">{props.labels.bl}:</span>{' '}
          {formatNullableText(props.item.bl, props.fallbackText)}
        </div>
        <div class="min-w-0 truncate">
          <span class="font-medium text-text-muted">{props.labels.derivedStatus}:</span>{' '}
          {formatNullableText(props.item.derivedStatus, props.fallbackText)}
        </div>
        <div class="min-w-0 truncate col-span-2">
          <span class="font-medium text-text-muted">{props.labels.eta}:</span>{' '}
          {formatEta(props.item.eta, props.fallbackText)}
        </div>
      </div>
    </button>
  )
}

type SearchPanelTranslation = ReturnType<typeof useTranslation>

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

export function SearchOverlayPanel(props: SearchOverlayPanelProps): JSX.Element {
  const { t, keys } = useTranslation()
  const [shortcutLabel, setShortcutLabel] = createSignal('Ctrl K')

  onMount(() => {
    const platform = navigator.platform.toLowerCase()
    const userAgent = navigator.userAgent.toLowerCase()
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

            <div class="max-h-[65vh] overflow-y-auto">
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
                  {(item, itemIndex) => {
                    return (
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
                    )
                  }}
                </For>
              </Show>
            </div>

            <div class="flex items-center justify-between border-t border-control-border bg-control-bg-hover px-4 py-2 text-xs-ui text-control-foreground">
              <div class="flex items-center gap-2">
                <kbd class="rounded border border-control-border bg-control-bg px-1 py-0.5 text-xs-ui text-control-popover-foreground">
                  <svg
                    class="inline-block w-3 h-3 align-text-center"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M12 22V1" />
                    <path d="m5 8 7-7 7 7" />
                    <path d="m5 16 7 7 7-7" />
                  </svg>
                </kbd>
                <span>{t(keys.search.footer.navigate)}</span>
              </div>
              <div class="flex items-center gap-2">
                <kbd class="rounded border border-control-border bg-control-bg px-1 py-0.5 text-xs-ui text-control-popover-foreground">
                  <svg
                    class="inline-block w-3 h-3 align-text-bottom"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <polyline points="9 10 4 15 9 20" />
                    <path d="M20 4v7a4 4 0 0 1-4 4H4" />
                  </svg>
                </kbd>
                <span>{t(keys.search.footer.select)}</span>
              </div>
              <div class="flex items-center gap-2">
                <kbd class="rounded border border-control-border bg-control-bg px-1 py-0.5 text-xs-ui text-control-popover-foreground">
                  esc
                </kbd>
                <span>{t(keys.search.footer.close)}</span>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </>
  )
}
