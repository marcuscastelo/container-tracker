import type { JSX } from 'solid-js'
import { createMemo, createSignal, For } from 'solid-js'
import type {
  DashboardImporterFilterOption,
  DashboardImporterFilterValue,
} from '~/modules/process/ui/viewmodels/dashboard-filter-interaction.vm'

import { ChevronDownIcon } from './Icons'

export function ImporterChipDropdown(props: {
  readonly label: string
  readonly allLabel: string
  readonly emptyLabel: string
  readonly searchPlaceholder: string
  readonly noMatchesLabel: string
  readonly testId: string
  readonly options: readonly DashboardImporterFilterOption[]
  readonly selectedImporterId: string | null
  readonly selectedImporterName: string | null
  readonly onSelect: (importer: DashboardImporterFilterValue | null) => void
}): JSX.Element {
  const [searchValue, setSearchValue] = createSignal('')
  const normalizedSelectedImporterName = createMemo(() =>
    toNormalizedNonBlankString(props.selectedImporterName),
  )

  const selectedOption = createMemo(() => {
    const selectedImporterId = props.selectedImporterId
    if (selectedImporterId !== null) {
      return props.options.find((option) => option.importerId === selectedImporterId) ?? null
    }
    const selectedImporterName = normalizedSelectedImporterName()
    if (selectedImporterName === null) return null
    return (
      props.options.find((option) => {
        if (option.importerId !== null) return false
        return toNormalizedNonBlankString(option.importerName) === selectedImporterName
      }) ?? null
    )
  })

  const hasSelection = () => selectedOption() !== null

  const chipLabel = () => {
    if (props.options.length === 0) return props.label
    return selectedOption() ? `${props.label}: ${selectedOption()?.label}` : props.label
  }

  const filteredOptions = createMemo(() => {
    const normalizedSearchValue = toNormalizedNonBlankString(searchValue())
    if (normalizedSearchValue === null) return props.options
    return props.options.filter((option) => {
      const normalizedLabel = option.label.toLocaleLowerCase('pt-BR')
      if (normalizedLabel.includes(normalizedSearchValue)) return true
      if (option.importerId === null) return false
      return option.importerId.toLocaleLowerCase('pt-BR').includes(normalizedSearchValue)
    })
  })

  const isOptionSelected = (option: DashboardImporterFilterOption): boolean => {
    const selected = selectedOption()
    if (selected === null) return false
    return (
      selected.importerId === option.importerId && selected.importerName === option.importerName
    )
  }

  const handleOptionSelect = (
    event: MouseEvent & { readonly currentTarget: HTMLElement },
    option: DashboardImporterFilterOption,
  ): void => {
    props.onSelect({
      importerId: option.importerId,
      importerName: option.importerName,
    })
    setSearchValue('')
    const detailsElement = event.currentTarget.closest('details')
    if (detailsElement instanceof HTMLDetailsElement) {
      detailsElement.open = false
    }
  }

  return (
    <details class="group relative" data-testid={props.testId}>
      <summary
        class={`inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors select-none ${
          hasSelection()
            ? 'border-slate-400 bg-slate-50 text-slate-800'
            : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
        }`}
      >
        <span class="truncate">{chipLabel()}</span>
        <ChevronDownIcon />
      </summary>

      <div class="absolute left-0 top-full z-20 mt-1 min-w-60 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
        <div class="border-b border-slate-100 px-2 py-2">
          <input
            type="search"
            class="w-full rounded border border-slate-200 px-2 py-1.5 text-[13px] text-slate-700 outline-none transition-colors focus:border-blue-400"
            placeholder={props.searchPlaceholder}
            value={searchValue()}
            onInput={(event) => setSearchValue(event.currentTarget.value)}
          />
        </div>
        {props.options.length === 0 ? (
          <p class="px-3 py-2 text-[13px] text-slate-500">{props.emptyLabel}</p>
        ) : filteredOptions().length === 0 ? (
          <p class="px-3 py-2 text-[13px] text-slate-500">{props.noMatchesLabel}</p>
        ) : (
          <ul class="max-h-56 overflow-y-auto p-1">
            <For each={filteredOptions()}>
              {(option) => (
                <li
                  role="button"
                  tabIndex={0}
                  class={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] transition-colors ${
                    isOptionSelected(option)
                      ? 'bg-slate-100 text-slate-800'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={(event) => handleOptionSelect(event as any, option)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleOptionSelect(e as any, option)
                  }}
                >
                  <span class="min-w-0 flex-1 truncate">{option.label}</span>
                  <span class="shrink-0 tabular-nums text-[11px] text-slate-400">
                    {option.count}
                  </span>
                </li>
              )}
            </For>
          </ul>
        )}
      </div>
    </details>
  )
}

function toNormalizedNonBlankString(value: string | null): string | null {
  if (value === null) return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  return trimmed.toLocaleLowerCase('pt-BR')
}
