import type { JSX } from 'solid-js'
import { MatchSourceIcon } from '~/capabilities/search/ui/SearchOverlay.icons'
import type { SearchResultItemVm } from '~/capabilities/search/ui/search.vm'
import { getBrowserLocale } from '~/shared/time/browser-locale'
import type { TemporalValueDto } from '~/shared/time/dto'
import { formatTemporalDate } from '~/shared/time/temporal-formatters'

function formatNullableText(value: string | null, fallbackText: string): string {
  if (value === null) return fallbackText

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallbackText
}

function formatContainers(value: readonly string[], fallbackText: string): string {
  if (value.length === 0) return fallbackText
  return value.join(', ')
}

function formatEta(value: TemporalValueDto | null, fallbackText: string): string {
  if (value === null) return fallbackText
  return formatTemporalDate(value, getBrowserLocale('en-US')) || value.value
}

export type SearchResultRowLabels = {
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

export function SearchResultRow(props: SearchResultRowProps): JSX.Element {
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
        <div class="col-span-2 min-w-0 truncate">
          <span class="font-medium text-text-muted">{props.labels.eta}:</span>{' '}
          {formatEta(props.item.eta, props.fallbackText)}
        </div>
      </div>
    </button>
  )
}
