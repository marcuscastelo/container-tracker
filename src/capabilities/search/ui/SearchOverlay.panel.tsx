import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
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
                      class={`${className} text-cyan-500`}
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
                    class={`${className} text-indigo-500`}
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
                class={`${className} text-slate-500`}
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
            class={`${className} text-blue-500`}
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
        class={`${className} text-emerald-500`}
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
      class={`w-full border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 ${
        isActive() ? 'bg-blue-50 text-blue-900' : 'bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <MatchSourceIcon source={props.item.matchSource} />
            <span class="truncate text-sm-ui font-semibold">
              {formatNullableText(props.item.processReference, props.item.processId)}
            </span>
          </div>
          <div class="mt-1 text-xs-ui text-slate-500">
            {props.labels.processId}: {props.item.processId}
          </div>
        </div>

        <span class="rounded bg-slate-100 px-2 py-0.5 text-xs-ui font-medium text-slate-600">
          {props.matchSourceLabel}
        </span>
      </div>

      <div class="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs-ui text-slate-600 sm:grid-cols-2">
        <div class="truncate">
          <span class="font-medium text-slate-500">{props.labels.importerName}:</span>{' '}
          {formatNullableText(props.item.importerName, props.fallbackText)}
        </div>
        <div class="truncate">
          <span class="font-medium text-slate-500">{props.labels.containers}:</span>{' '}
          {formatContainers(props.item.containers, props.fallbackText)}
        </div>
        <div class="truncate">
          <span class="font-medium text-slate-500">{props.labels.carrier}:</span>{' '}
          {formatNullableText(props.item.carrier, props.fallbackText)}
        </div>
        <div class="truncate">
          <span class="font-medium text-slate-500">{props.labels.vesselName}:</span>{' '}
          {formatNullableText(props.item.vesselName, props.fallbackText)}
        </div>
        <div class="truncate">
          <span class="font-medium text-slate-500">{props.labels.bl}:</span>{' '}
          {formatNullableText(props.item.bl, props.fallbackText)}
        </div>
        <div class="truncate">
          <span class="font-medium text-slate-500">{props.labels.derivedStatus}:</span>{' '}
          {formatNullableText(props.item.derivedStatus, props.fallbackText)}
        </div>
        <div class="truncate sm:col-span-2">
          <span class="font-medium text-slate-500">{props.labels.eta}:</span>{' '}
          {formatEta(props.item.eta, props.fallbackText)}
        </div>
      </div>
    </button>
  )
}

export function SearchOverlayPanel(props: SearchOverlayPanelProps): JSX.Element {
  const { t, keys } = useTranslation()

  const matchSourceLabel = (source: SearchResultItemVm['matchSource']): string => {
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

  const shouldShowResultsState = () => props.query.trim().length >= props.minimumQueryLength
  const showShortQueryHint = () => !shouldShowResultsState()
  const fallbackText = t(keys.search.notAvailable)
  const labels: SearchResultRowLabels = {
    processId: t(keys.search.fields.processId),
    importerName: t(keys.search.fields.importerName),
    containers: t(keys.search.fields.containers),
    carrier: t(keys.search.fields.carrier),
    vesselName: t(keys.search.fields.vesselName),
    bl: t(keys.search.fields.bl),
    derivedStatus: t(keys.search.fields.derivedStatus),
    eta: t(keys.search.fields.eta),
  }

  return (
    <>
      <button
        type="button"
        onClick={() => props.onOpen()}
        class="group flex w-full max-w-4xl items-center gap-2.5 rounded border border-slate-200 bg-white px-3 py-1.5 text-left shadow-sm transition-all hover:border-slate-300 hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
      >
        <SearchIcon />
        <span class="flex-1 text-md-ui text-slate-400">{t(keys.search.placeholder)}</span>
        <kbd class="hidden items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-micro font-semibold text-slate-400 sm:inline-flex">
          <span class="text-micro">{t(keys.search.footer.modifier)}</span>
          <span>K</span>
        </kbd>
      </button>

      <Show when={props.isOpen}>
        <div
          class="fixed inset-0 z-50 flex items-start justify-center px-2 pt-[8vh] sm:px-4"
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
            class="relative z-10 w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            style={{ animation: 'search-modal-in 150ms ease-out' }}
            role="dialog"
            aria-modal="true"
            aria-label={t(keys.search.placeholder)}
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
                class="flex-1 bg-transparent text-sm-ui text-slate-900 placeholder-slate-400 outline-none"
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
              <kbd class="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs-ui text-slate-400">
                Esc
              </kbd>
            </div>

            <div class="max-h-[65vh] overflow-y-auto">
              <Show when={props.state === 'loading' && shouldShowResultsState()}>
                <div class="px-4 py-6 text-center text-sm-ui text-slate-400" />
              </Show>

              <Show when={props.state === 'error' && shouldShowResultsState()}>
                <div class="px-4 py-6 text-center text-sm-ui text-red-500">
                  {t(keys.search.error)}
                </div>
              </Show>

              <Show when={props.state === 'empty' && shouldShowResultsState()}>
                <div class="px-4 py-6 text-center text-sm-ui text-slate-400">
                  {t(keys.search.noResults)}
                </div>
              </Show>

              <Show when={showShortQueryHint() && props.state !== 'loading'}>
                <div class="px-4 py-6 text-center text-sm-ui text-slate-400">
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
                        matchSourceLabel={matchSourceLabel(item.matchSource)}
                        onSelectResult={props.onSelectResult}
                        onHoverIndex={props.onHoverIndex}
                      />
                    )
                  }}
                </For>
              </Show>
            </div>

            <div class="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs-ui text-slate-400">
              <div class="flex items-center gap-2">
                <kbd class="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs-ui">
                  ↑↓
                </kbd>
                <span>{t(keys.search.footer.navigate)}</span>
              </div>
              <div class="flex items-center gap-2">
                <kbd class="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs-ui">↵</kbd>
                <span>{t(keys.search.footer.select)}</span>
              </div>
              <div class="flex items-center gap-2">
                <kbd class="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs-ui">
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
