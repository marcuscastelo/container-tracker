import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  GLOBAL_SEARCH_RESULTS_LIST_ID,
  GLOBAL_SEARCH_SUGGESTIONS_LIST_ID,
  getGlobalSearchResultOptionId,
  getGlobalSearchSuggestionOptionId,
  resolveGlobalSearchActiveDescendantId,
  resolveGlobalSearchActiveListId,
} from '~/capabilities/search/ui/screens/global-search/views/globalSearch.a11y'

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(TEST_DIR, '../../../../..')

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(REPO_ROOT, relativePath), 'utf8')
}

describe('global search accessibility', () => {
  it('builds stable listbox and option ids', () => {
    expect(GLOBAL_SEARCH_SUGGESTIONS_LIST_ID).toBe('global-search-suggestions-list')
    expect(GLOBAL_SEARCH_RESULTS_LIST_ID).toBe('global-search-results-list')
    expect(getGlobalSearchSuggestionOptionId(2)).toBe('global-search-suggestion-2')
    expect(getGlobalSearchResultOptionId(4)).toBe('global-search-result-4')
  })

  it('resolves active listbox and descendant from current search state', () => {
    expect(
      resolveGlobalSearchActiveListId({
        showSuggestions: true,
        showResults: true,
        activeSuggestionIndex: 3,
        activeResultIndex: 1,
      }),
    ).toBe(GLOBAL_SEARCH_SUGGESTIONS_LIST_ID)
    expect(
      resolveGlobalSearchActiveDescendantId({
        showSuggestions: true,
        showResults: true,
        activeSuggestionIndex: 3,
        activeResultIndex: 1,
      }),
    ).toBe('global-search-suggestion-3')

    expect(
      resolveGlobalSearchActiveListId({
        showSuggestions: false,
        showResults: true,
        activeSuggestionIndex: -1,
        activeResultIndex: 1,
      }),
    ).toBe(GLOBAL_SEARCH_RESULTS_LIST_ID)
    expect(
      resolveGlobalSearchActiveDescendantId({
        showSuggestions: false,
        showResults: true,
        activeSuggestionIndex: -1,
        activeResultIndex: 1,
      }),
    ).toBe('global-search-result-1')

    expect(
      resolveGlobalSearchActiveDescendantId({
        showSuggestions: false,
        showResults: false,
        activeSuggestionIndex: -1,
        activeResultIndex: -1,
      }),
    ).toBeUndefined()
  })

  it('keeps combobox, listbox, option, and localized kind semantics in source', () => {
    const composerSource = readSource(
      'src/capabilities/search/ui/screens/global-search/views/GlobalSearchComposerView.tsx',
    )
    const suggestionsSource = readSource(
      'src/capabilities/search/ui/screens/global-search/views/GlobalSearchSuggestionsView.tsx',
    )
    const resultsSource = readSource(
      'src/capabilities/search/ui/screens/global-search/views/GlobalSearchResultsView.tsx',
    )
    const resultRowSource = readSource(
      'src/capabilities/search/ui/screens/global-search/views/GlobalSearchResultRow.tsx',
    )

    expect(composerSource).toContain('role="combobox"')
    expect(composerSource).toContain('aria-controls={props.listboxId}')
    expect(composerSource).toContain('aria-activedescendant={props.activeDescendantId}')

    expect(suggestionsSource).toContain('role="listbox"')
    expect(suggestionsSource).toContain('role="option"')
    expect(suggestionsSource).toContain('aria-selected={props.activeIndex === index()}')
    expect(suggestionsSource).toContain('translation.keys.search.suggestionKinds.field')
    expect(suggestionsSource).toContain('translation.keys.search.suggestionKinds.value')
    expect(suggestionsSource).toContain('translation.keys.search.suggestionKinds.example')
    expect(suggestionsSource).not.toContain("return 'field'")

    expect(resultsSource).toContain('role="listbox"')
    expect(resultRowSource).toContain('role="option"')
    expect(resultRowSource).toContain('aria-selected={props.active}')
  })
})
