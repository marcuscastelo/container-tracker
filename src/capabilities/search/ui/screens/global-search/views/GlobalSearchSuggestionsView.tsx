import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import type { GlobalSearchSuggestionVM } from '~/capabilities/search/ui/screens/global-search/types/global-search.vm'
import {
  GLOBAL_SEARCH_SUGGESTIONS_LIST_ID,
  getGlobalSearchSuggestionOptionId,
} from '~/capabilities/search/ui/screens/global-search/views/globalSearch.a11y'
import type { TranslationApi } from '~/shared/localization/i18n'
import { useTranslation } from '~/shared/localization/i18n'

type GlobalSearchSuggestionsViewProps = {
  readonly suggestions: readonly GlobalSearchSuggestionVM[]
  readonly activeIndex: number
  readonly onSelect: (suggestion: GlobalSearchSuggestionVM) => void
  readonly onHover: (index: number) => void
  readonly listLabel: string
}

function kindLabel(translation: TranslationApi, suggestion: GlobalSearchSuggestionVM): string {
  if (suggestion.kind === 'field') {
    return translation.t(translation.keys.search.suggestionKinds.field)
  }

  if (suggestion.kind === 'value') {
    return translation.t(translation.keys.search.suggestionKinds.value)
  }

  return translation.t(translation.keys.search.suggestionKinds.example)
}

export function GlobalSearchSuggestionsView(props: GlobalSearchSuggestionsViewProps): JSX.Element {
  const translation = useTranslation()

  return (
    <div
      id={GLOBAL_SEARCH_SUGGESTIONS_LIST_ID}
      class="border-b border-control-border"
      role="listbox"
      aria-label={props.listLabel}
    >
      <For each={props.suggestions}>
        {(suggestion, index) => (
          <button
            id={getGlobalSearchSuggestionOptionId(index())}
            type="button"
            onClick={() => props.onSelect(suggestion)}
            onMouseEnter={() => props.onHover(index())}
            class={`motion-focus-surface motion-interactive flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm-ui ${
              props.activeIndex === index()
                ? 'bg-control-selected-bg text-control-selected-foreground'
                : 'bg-control-popover text-control-popover-foreground hover:bg-control-bg-hover'
            }`}
            role="option"
            tabindex={-1}
            aria-selected={props.activeIndex === index()}
          >
            <span class="truncate">{suggestion.label}</span>
            <span class="shrink-0 text-xs-ui text-text-muted">
              {kindLabel(translation, suggestion)}
            </span>
          </button>
        )}
      </For>
    </div>
  )
}
