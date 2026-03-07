import type { JSX } from 'solid-js'
import { createMemo, createSignal, Match, Switch } from 'solid-js'
import { ChevronDownIcon } from '~/modules/process/ui/components/unified/Icons'
import { ImporterOptionsList } from '~/modules/process/ui/components/unified/ImporterOptionsList'
import type {
  DashboardImporterFilterOption,
  DashboardImporterFilterValue,
} from '~/modules/process/ui/viewmodels/dashboard-filter-interaction.vm'

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

  const handleOptionSelect = (option: DashboardImporterFilterOption): void => {
    props.onSelect({
      importerId: option.importerId,
      importerName: option.importerName,
    })
    setSearchValue('')
    const detailsElement = document.querySelector('details[open]')
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
        <Switch>
          <Match when={props.options.length === 0}>
            <p class="px-3 py-2 text-[13px] text-slate-500">{props.emptyLabel}</p>
          </Match>
          <Match when={filteredOptions().length === 0}>
            <p class="px-3 py-2 text-[13px] text-slate-500">{props.noMatchesLabel}</p>
          </Match>
          <Match when={true}>
            <ImporterOptionsList
              options={filteredOptions()}
              isSelected={isOptionSelected}
              onSelect={handleOptionSelect}
            />
          </Match>
        </Switch>
      </div>
    </details>
  )
}

function toOptionalNonBlankString(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toNormalizedNonBlankString(value: string | null | undefined): string | null {
  const nonBlankValue = toOptionalNonBlankString(value)
  if (nonBlankValue === null) return null
  return nonBlankValue.toLocaleLowerCase('pt-BR')
}
