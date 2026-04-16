import { createComponent } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { describe, expect, it, vi } from 'vitest'
import { ActiveFiltersPanel } from '~/modules/process/ui/components/unified/ActiveFiltersPanel'
import { MultiSelectOptionsList } from '~/modules/process/ui/components/unified/MultiSelectOptionsList'
import { SingleSelectOptionsList } from '~/modules/process/ui/components/unified/SingleSelectOptionsList'

vi.mock('lucide-solid', () => ({
  Check: () => null,
}))

describe('unified filter components', () => {
  it('renders active chips for each selected dashboard filter category', () => {
    const html = renderToString(() =>
      createComponent(ActiveFiltersPanel, {
        selectedSeverity: 'danger',
        selectedProviders: ['MSC', 'ONE'],
        selectedStatuses: ['IN_TRANSIT'],
        selectedImporterChipLabel: 'Flush Logistics',
        onSeveritySelect: () => undefined,
        onProviderToggle: () => undefined,
        onStatusToggle: () => undefined,
        onImporterSelect: () => undefined,
      }),
    )

    expect(html).toContain('Filtros ativos')
    expect(html).toContain('Severidade: Crítico')
    expect(html).toContain('Armador: MSC')
    expect(html).toContain('Armador: ONE')
    expect(html).toContain('Status: Em Trânsito')
    expect(html).toContain('Importador: Flush Logistics')
  })

  it('keeps multi-select options visibly selected and includes counts', () => {
    const html = renderToString(() =>
      createComponent(MultiSelectOptionsList<'MSC' | 'ONE'>, {
        options: [
          {
            value: 'MSC',
            label: 'MSC',
            count: 3,
          },
          {
            value: 'ONE',
            label: 'ONE',
            count: 1,
          },
        ],
        isSelected: (value) => value === 'MSC',
        onToggle: () => undefined,
      }),
    )

    expect(html).toContain('MSC')
    expect(html).toContain('ONE')
    expect(html).toContain('3')
    expect(html).toContain('bg-control-selected-bg')
  })

  it('renders the all option and selected value for single-select controls', () => {
    const html = renderToString(() =>
      createComponent(SingleSelectOptionsList<'danger' | 'warning'>, {
        allLabel: 'Todas',
        selectedValue: 'warning',
        options: [
          {
            value: 'danger',
            label: 'Crítico',
            count: 2,
          },
          {
            value: 'warning',
            label: 'Atenção',
            count: 4,
          },
        ],
        onSelect: () => undefined,
      }),
    )

    expect(html).toContain('Todas')
    expect(html).toContain('Crítico')
    expect(html).toContain('Atenção')
    expect(html).toContain('4')
    expect(html).toContain('bg-control-selected-bg')
  })
})
