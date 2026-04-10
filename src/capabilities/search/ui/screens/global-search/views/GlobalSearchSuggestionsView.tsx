import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import type { GlobalSearchSuggestionVM } from '~/capabilities/search/ui/screens/global-search/types/global-search.vm'

type GlobalSearchSuggestionsViewProps = {
  readonly suggestions: readonly GlobalSearchSuggestionVM[]
  readonly activeIndex: number
  readonly onSelect: (suggestion: GlobalSearchSuggestionVM) => void
  readonly onHover: (index: number) => void
}

function kindLabel(suggestion: GlobalSearchSuggestionVM): string {
  if (suggestion.kind === 'field') return 'field'
  if (suggestion.kind === 'value') return 'value'
  return 'example'
}

export function GlobalSearchSuggestionsView(props: GlobalSearchSuggestionsViewProps): JSX.Element {
  return (
    <div class="border-b border-control-border">
      <For each={props.suggestions}>
        {(suggestion, index) => (
          <button
            type="button"
            onClick={() => props.onSelect(suggestion)}
            onMouseEnter={() => props.onHover(index())}
            class={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm-ui transition-colors ${
              props.activeIndex === index()
                ? 'bg-control-selected-bg text-control-selected-foreground'
                : 'bg-control-popover text-control-popover-foreground hover:bg-control-bg-hover'
            }`}
          >
            <span class="truncate">{suggestion.label}</span>
            <span class="shrink-0 text-xs-ui text-text-muted">{kindLabel(suggestion)}</span>
          </button>
        )}
      </For>
    </div>
  )
}
