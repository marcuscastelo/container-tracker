import { createComponent } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { describe, expect, it, vi } from 'vitest'
import { GlobalSearchComposerView } from '~/capabilities/search/ui/screens/global-search/views/GlobalSearchComposerView'

vi.mock('~/capabilities/search/ui/SearchOverlay.icons', () => ({
  SearchIcon: () => <span>search-icon</span>,
}))

describe('GlobalSearchComposerView', () => {
  it('renders chips, combobox a11y wiring and clear affordances', () => {
    const html = renderToString(() =>
      createComponent(GlobalSearchComposerView, {
        chips: [
          {
            key: 'container',
            value: 'MSCU1234567',
            label: 'Container: MSCU1234567',
          },
          {
            key: 'status',
            value: 'IN_TRANSIT',
            label: 'Status: Em Trânsito',
          },
        ],
        draft: 'CA048',
        placeholder: 'Buscar processo, container, BL...',
        clearLabel: 'Limpar busca',
        onDraftInput: () => undefined,
        onKeyDown: () => undefined,
        onRemoveChip: () => undefined,
        onClear: () => undefined,
        setInputRef: () => undefined,
        expanded: true,
        listboxId: 'global-search-results-list',
        activeDescendantId: 'global-search-result-0',
      }),
    )

    expect(html).toContain('search-icon')
    expect(html).toContain('Container: MSCU1234567')
    expect(html).toContain('Status: Em Trânsito')
    expect(html).toContain('role="combobox"')
    expect(html).toContain('aria-controls="global-search-results-list"')
    expect(html).toContain('aria-activedescendant="global-search-result-0"')
    expect(html).toContain('placeholder="Buscar processo, container, BL..."')
    expect(html).toContain('aria-label="Limpar busca"')
    expect(html).toContain('<kbd')
    expect(html).toContain('Esc')
  })
})
