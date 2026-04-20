import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { GlobalSearchResultItemVM } from '~/capabilities/search/ui/screens/global-search/types/global-search.vm'
import { getGlobalSearchResultOptionId } from '~/capabilities/search/ui/screens/global-search/views/globalSearch.a11y'

type GlobalSearchResultRowProps = {
  readonly item: GlobalSearchResultItemVM
  readonly index: number
  readonly active: boolean
  readonly onSelect: (item: GlobalSearchResultItemVM) => void
  readonly onHover: (index: number) => void
}

export function GlobalSearchResultRow(props: GlobalSearchResultRowProps): JSX.Element {
  return (
    <button
      id={getGlobalSearchResultOptionId(props.index)}
      type="button"
      data-search-index={props.index}
      data-search-process-id={props.item.processId}
      onClick={() => props.onSelect(props.item)}
      onMouseEnter={() => props.onHover(props.index)}
      class={`motion-focus-surface motion-interactive flex w-full flex-col gap-3 border-b border-control-border px-4 py-3 text-left last:border-b-0 ${
        props.active
          ? 'bg-control-selected-bg text-control-selected-foreground'
          : 'bg-control-popover text-control-popover-foreground hover:bg-control-bg-hover'
      }`}
      role="option"
      tabindex={-1}
      aria-selected={props.active}
    >
      <div class="flex flex-col gap-1">
        <div class="flex items-start justify-between gap-3">
          <span class="truncate text-sm-ui font-semibold">{props.item.title}</span>
          <div class="flex flex-wrap justify-end gap-1">
            <For each={props.item.badges}>
              {(badge) => (
                <span class="rounded bg-control-bg-hover px-2 py-0.5 text-xs-ui text-control-foreground">
                  {badge}
                </span>
              )}
            </For>
          </div>
        </div>
        <div class="text-xs-ui text-text-muted">{props.item.supportingId}</div>
      </div>

      <Show when={props.item.matchSummary.length > 0}>
        <div class="flex flex-wrap gap-2">
          <For each={props.item.matchSummary}>
            {(summary) => (
              <span class="rounded border border-control-border bg-control-bg-hover px-2 py-1 text-xs-ui text-control-foreground">
                {summary}
              </span>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.item.meta.length > 0}>
        <div class="grid grid-cols-1 gap-2 text-xs-ui text-control-popover-foreground sm:grid-cols-2">
          <For each={props.item.meta}>
            {(meta) => (
              <div class="min-w-0 truncate">
                <span class="font-medium text-text-muted">{meta.label}:</span> {meta.value}
              </div>
            )}
          </For>
        </div>
      </Show>
    </button>
  )
}
