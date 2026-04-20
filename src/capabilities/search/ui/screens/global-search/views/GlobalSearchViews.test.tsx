import { createComponent } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { describe, expect, it } from 'vitest'
import type {
  GlobalSearchResultItemVM,
  GlobalSearchSuggestionVM,
} from '~/capabilities/search/ui/screens/global-search/types/global-search.vm'
import { GlobalSearchBodyView } from '~/capabilities/search/ui/screens/global-search/views/GlobalSearchBodyView'
import { GlobalSearchResultRow } from '~/capabilities/search/ui/screens/global-search/views/GlobalSearchResultRow'
import { GlobalSearchSuggestionsView } from '~/capabilities/search/ui/screens/global-search/views/GlobalSearchSuggestionsView'

const RESULT_ITEM: GlobalSearchResultItemVM = {
  processId: 'process-1',
  title: 'CA048-26',
  supportingId: 'ID do processo: process-1',
  badges: ['Em trânsito', 'Alerta de dados'],
  matchSummary: ['Container MSCU1234567'],
  meta: [
    {
      label: 'Importador',
      value: 'Flush Logistics',
    },
  ],
}

const SUGGESTIONS: readonly GlobalSearchSuggestionVM[] = [
  {
    kind: 'field',
    fieldKey: 'container',
    value: null,
    label: 'Container',
    description: null,
    insertText: 'container:',
  },
  {
    kind: 'value',
    fieldKey: 'status',
    value: 'IN_TRANSIT',
    label: 'Em trânsito',
    description: null,
    insertText: 'status:IN_TRANSIT',
  },
]

function renderBody(overrides: Partial<Parameters<typeof GlobalSearchBodyView>[0]>): string {
  return renderToString(() =>
    createComponent(GlobalSearchBodyView, {
      uiState: 'empty',
      showDiscoveryState: false,
      showEmptyState: false,
      errorLabel: 'Falha ao buscar',
      discoveryLabel: 'Digite para buscar',
      emptyTitle: 'Nada encontrado',
      emptyDescription: 'Tente outro termo',
      emptyExamples: ['container:MSCU1234567'],
      loadingLabel: 'Buscando',
      results: [],
      activeIndex: -1,
      onSelect: () => undefined,
      onHover: () => undefined,
      onVisiblePrefetch: () => undefined,
      listLabel: 'Resultados',
      ...overrides,
    }),
  )
}

describe('global search views', () => {
  it('renders discovery, loading, error and empty states without leaking stale results', () => {
    expect(
      renderBody({
        showDiscoveryState: true,
      }),
    ).toContain('Digite para buscar')
    expect(
      renderBody({
        uiState: 'loading',
      }),
    ).toContain('Buscando')
    expect(
      renderBody({
        uiState: 'error',
      }),
    ).toContain('Falha ao buscar')

    const emptyHtml = renderBody({
      showEmptyState: true,
    })
    expect(emptyHtml).toContain('Nada encontrado')
    expect(emptyHtml).toContain('container:MSCU1234567')
    expect(emptyHtml).not.toContain('CA048-26')
  })

  it('renders ready results with operational badges, matches and metadata', () => {
    const html = renderBody({
      uiState: 'ready',
      results: [RESULT_ITEM],
      activeIndex: 0,
    })

    expect(html).toContain('role="listbox"')
    expect(html).toContain('CA048-26')
    expect(html).toContain('Em trânsito')
    expect(html).toContain('Container MSCU1234567')
    expect(html).toContain('Flush Logistics')
  })

  it('marks active result rows and keeps optional sections absent when not provided', () => {
    const html = renderToString(() =>
      createComponent(GlobalSearchResultRow, {
        item: {
          ...RESULT_ITEM,
          badges: [],
          matchSummary: [],
          meta: [],
        },
        index: 2,
        active: true,
        onSelect: () => undefined,
        onHover: () => undefined,
      }),
    )

    expect(html).toContain('id="global-search-result-2"')
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('data-search-process-id="process-1"')
    expect(html).not.toContain('Container MSCU1234567')
    expect(html).not.toContain('Importador')
  })

  it('renders suggestions with localized kind labels and active option semantics', () => {
    const html = renderToString(() =>
      createComponent(GlobalSearchSuggestionsView, {
        suggestions: SUGGESTIONS,
        activeIndex: 1,
        onSelect: () => undefined,
        onHover: () => undefined,
        listLabel: 'Sugestões',
      }),
    )

    expect(html).toContain('role="listbox"')
    expect(html).toContain('Container')
    expect(html).toContain('Em trânsito')
    expect(html).toContain('aria-selected="true"')
  })
})
