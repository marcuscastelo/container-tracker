export const GLOBAL_SEARCH_SUGGESTIONS_LIST_ID = 'global-search-suggestions-list'
export const GLOBAL_SEARCH_RESULTS_LIST_ID = 'global-search-results-list'

export type GlobalSearchActiveA11yState = Readonly<{
  showSuggestions: boolean
  showResults: boolean
  activeSuggestionIndex: number
  activeResultIndex: number
}>

export function getGlobalSearchSuggestionOptionId(index: number): string {
  return `global-search-suggestion-${String(index)}`
}

export function getGlobalSearchResultOptionId(index: number): string {
  return `global-search-result-${String(index)}`
}

export function resolveGlobalSearchActiveListId(
  state: GlobalSearchActiveA11yState,
): string | undefined {
  if (state.showSuggestions) {
    return GLOBAL_SEARCH_SUGGESTIONS_LIST_ID
  }

  if (state.showResults) {
    return GLOBAL_SEARCH_RESULTS_LIST_ID
  }

  return undefined
}

export function resolveGlobalSearchActiveDescendantId(
  state: GlobalSearchActiveA11yState,
): string | undefined {
  if (state.showSuggestions) {
    return state.activeSuggestionIndex >= 0
      ? getGlobalSearchSuggestionOptionId(state.activeSuggestionIndex)
      : undefined
  }

  if (state.showResults) {
    return state.activeResultIndex >= 0
      ? getGlobalSearchResultOptionId(state.activeResultIndex)
      : undefined
  }

  return undefined
}
