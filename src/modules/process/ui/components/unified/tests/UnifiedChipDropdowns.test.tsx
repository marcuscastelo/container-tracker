import { createComponent } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { describe, expect, it } from 'vitest'
import { ImporterChipDropdown } from '~/modules/process/ui/components/unified/ImporterChipDropdown'
import { MultiSelectChipDropdown } from '~/modules/process/ui/components/unified/MultiSelectChipDropdown'
import { SingleSelectChipDropdown } from '~/modules/process/ui/components/unified/SingleSelectChipDropdown'

describe('unified chip dropdowns', () => {
  it('renders empty multi-select dropdown state when no options are available', () => {
    const html = renderToString(() =>
      createComponent(MultiSelectChipDropdown<'MSC' | 'ONE'>, {
        label: 'Armador',
        allLabel: 'Todos',
        emptyLabel: 'Nenhuma opção disponível',
        testId: 'provider-filter',
        selectedValues: [],
        options: [],
        onToggle: () => undefined,
        toSelectedCountLabel: (count) => `${count} selecionados`,
      }),
    )

    expect(html).toContain('data-testid="provider-filter"')
    expect(html).toContain('Armador')
    expect(html).toContain('Nenhuma opção disponível')
    expect(html).toContain('border-control-border')
  })

  it('shows selected count summary for multi-select dropdowns with multiple active filters', () => {
    const html = renderToString(() =>
      createComponent(MultiSelectChipDropdown<'MSC' | 'ONE' | 'MAERSK'>, {
        label: 'Armador',
        allLabel: 'Todos',
        emptyLabel: 'Nenhuma opção disponível',
        testId: 'provider-filter',
        selectedValues: ['MSC', 'ONE'],
        options: [
          {
            value: 'MSC',
            label: 'MSC',
            count: 3,
          },
          {
            value: 'ONE',
            label: 'ONE',
            count: 2,
          },
          {
            value: 'MAERSK',
            label: 'Maersk',
            count: 1,
          },
        ],
        onToggle: () => undefined,
        toSelectedCountLabel: (count) => `${count} selecionados`,
      }),
    )

    expect(html).toContain('Armador: 2 selecionados')
    expect(html).toContain('bg-control-selected-bg')
    expect(html).toContain('MSC')
    expect(html).toContain('ONE')
    expect(html).toContain('Maersk')
  })

  it('shows the selected label for single-select dropdowns and keeps the all option available', () => {
    const html = renderToString(() =>
      createComponent(SingleSelectChipDropdown<'danger' | 'warning'>, {
        label: 'Severidade',
        allLabel: 'Todas',
        testId: 'severity-filter',
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
        toOptionLabel: (value) => value,
      }),
    )

    expect(html).toContain('data-testid="severity-filter"')
    expect(html).toContain('Severidade: Atenção')
    expect(html).toContain('Todas')
    expect(html).toContain('Crítico')
    expect(html).toContain('4')
    expect(html).toContain('bg-control-selected-bg')
  })

  it('matches importer selection by importer id and renders the selected chip label', () => {
    const html = renderToString(() =>
      createComponent(ImporterChipDropdown, {
        label: 'Importador',
        allLabel: 'Todos',
        emptyLabel: 'Nenhum importador disponível',
        searchPlaceholder: 'Buscar importador',
        noMatchesLabel: 'Sem resultados',
        testId: 'importer-filter',
        options: [
          {
            importerId: 'importer-1',
            importerName: 'Flush Logistics',
            label: 'Flush Logistics (importer-1)',
            count: 3,
          },
          {
            importerId: null,
            importerName: 'Acme Imports',
            label: 'Acme Imports',
            count: 1,
          },
        ],
        selectedImporterId: 'importer-1',
        selectedImporterName: 'ignored',
        onSelect: () => undefined,
      }),
    )

    expect(html).toContain('data-testid="importer-filter"')
    expect(html).toContain('Importador: Flush Logistics (importer-1)')
    expect(html).toContain('Buscar importador')
    expect(html).toContain('Acme Imports')
    expect(html).toContain('3')
  })

  it('falls back to importer name matching when the selected importer has no id', () => {
    const html = renderToString(() =>
      createComponent(ImporterChipDropdown, {
        label: 'Importador',
        allLabel: 'Todos',
        emptyLabel: 'Nenhum importador disponível',
        searchPlaceholder: 'Buscar importador',
        noMatchesLabel: 'Sem resultados',
        testId: 'importer-filter',
        options: [
          {
            importerId: null,
            importerName: 'Acme Imports',
            label: 'Acme Imports',
            count: 1,
          },
        ],
        selectedImporterId: null,
        selectedImporterName: ' acme imports ',
        onSelect: () => undefined,
      }),
    )

    expect(html).toContain('Importador: Acme Imports')
    expect(html).toContain('bg-control-selected-bg')
  })

  it('renders explicit empty importer state when there are no importer options', () => {
    const html = renderToString(() =>
      createComponent(ImporterChipDropdown, {
        label: 'Importador',
        allLabel: 'Todos',
        emptyLabel: 'Nenhum importador disponível',
        searchPlaceholder: 'Buscar importador',
        noMatchesLabel: 'Sem resultados',
        testId: 'importer-filter',
        options: [],
        selectedImporterId: null,
        selectedImporterName: null,
        onSelect: () => undefined,
      }),
    )

    expect(html).toContain('Nenhum importador disponível')
    expect(html).toContain('Importador')
  })
})
