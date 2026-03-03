import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type {
  DashboardImporterFilterOption,
  DashboardImporterFilterValue,
  DashboardProviderFilterOption,
  DashboardStatusFilterOption,
} from '~/modules/process/ui/viewmodels/dashboard-filter-interaction.vm'
import type { TrackingStatusCode } from '~/modules/tracking/application/projection/tracking.status.projection'
import { useTranslation } from '~/shared/localization/i18n'

type FilterControlOption<T extends string> = {
  readonly value: T
  readonly label: string
  readonly count: number
}

type MultiSelectFilterControlProps<T extends string> = {
  readonly label: string
  readonly allLabel: string
  readonly emptyLabel: string
  readonly testId: string
  readonly selectedValues: readonly T[]
  readonly options: readonly FilterControlOption<T>[]
  readonly onToggle: (value: T) => void
  readonly toSelectedCountLabel: (count: number) => string
}

type Props = {
  readonly providers: readonly DashboardProviderFilterOption[]
  readonly statuses: readonly DashboardStatusFilterOption[]
  readonly importers: readonly DashboardImporterFilterOption[]
  readonly selectedProviders: readonly string[]
  readonly selectedStatuses: readonly TrackingStatusCode[]
  readonly selectedImporterId: string | null
  readonly selectedImporterName: string | null
  readonly onProviderToggle: (provider: string) => void
  readonly onStatusToggle: (status: TrackingStatusCode) => void
  readonly onImporterSelect: (importer: DashboardImporterFilterValue | null) => void
  readonly onClearAllFilters: () => void
}

function MultiSelectFilterControl<T extends string>(
  props: MultiSelectFilterControlProps<T>,
): JSX.Element {
  const selectedCount = () => props.selectedValues.length

  const isSelected = (value: T): boolean => {
    return props.selectedValues.some((selectedValue) => selectedValue === value)
  }

  const summaryLabel = () => {
    if (props.options.length === 0) return props.emptyLabel
    if (selectedCount() === 0) return props.allLabel
    return props.toSelectedCountLabel(selectedCount())
  }

  return (
    <details class="group relative w-full" data-testid={props.testId}>
      <summary class="flex cursor-pointer list-none items-center justify-between rounded border border-slate-200 bg-white px-2.5 py-1.5 text-left transition-colors hover:border-slate-300">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {props.label}
        </span>
        <span class="max-w-[65%] truncate text-[12px] text-slate-700">{summaryLabel()}</span>
      </summary>

      <div class="absolute left-0 top-full z-10 mt-1 w-full min-w-[220px] overflow-hidden rounded border border-slate-200 bg-white shadow-lg">
        <Show
          when={props.options.length > 0}
          fallback={<p class="px-3 py-2 text-[12px] text-slate-500">{props.emptyLabel}</p>}
        >
          <ul class="max-h-56 overflow-y-auto p-1">
            <For each={props.options}>
              {(option) => (
                <li>
                  <label class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      class="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={isSelected(option.value)}
                      onInput={() => props.onToggle(option.value)}
                    />
                    <span class="min-w-0 flex-1 truncate">{option.label}</span>
                    <span class="shrink-0 tabular-nums text-[11px] text-slate-400">
                      {option.count}
                    </span>
                  </label>
                </li>
              )}
            </For>
          </ul>
        </Show>
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

type ImporterFilterControlProps = {
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
}

function ImporterFilterControl(props: ImporterFilterControlProps): JSX.Element {
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

  const summaryLabel = createMemo(() => {
    if (props.options.length === 0) return props.emptyLabel
    return selectedOption()?.label ?? props.allLabel
  })

  const filteredOptions = createMemo(() => {
    const normalizedSearchValue = toNormalizedNonBlankString(searchValue())
    if (normalizedSearchValue === null) {
      return props.options
    }

    return props.options.filter((option) => {
      const normalizedLabel = option.label.toLocaleLowerCase('pt-BR')
      if (normalizedLabel.includes(normalizedSearchValue)) {
        return true
      }

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
    event: MouseEvent & { readonly currentTarget: HTMLButtonElement },
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
    <details class="group relative w-full" data-testid={props.testId}>
      <summary class="flex cursor-pointer list-none items-center justify-between rounded border border-slate-200 bg-white px-2.5 py-1.5 text-left transition-colors hover:border-slate-300">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {props.label}
        </span>
        <span class="max-w-[65%] truncate text-[12px] text-slate-700">{summaryLabel()}</span>
      </summary>

      <div class="absolute left-0 top-full z-10 mt-1 w-full min-w-[240px] overflow-hidden rounded border border-slate-200 bg-white shadow-lg">
        <div class="border-b border-slate-100 px-2 py-2">
          <input
            type="search"
            class="w-full rounded border border-slate-200 px-2 py-1.5 text-[12px] text-slate-700 outline-none transition-colors focus:border-blue-400"
            placeholder={props.searchPlaceholder}
            value={searchValue()}
            onInput={(event) => setSearchValue(event.currentTarget.value)}
          />
        </div>
        <Show
          when={props.options.length > 0}
          fallback={<p class="px-3 py-2 text-[12px] text-slate-500">{props.emptyLabel}</p>}
        >
          <Show
            when={filteredOptions().length > 0}
            fallback={<p class="px-3 py-2 text-[12px] text-slate-500">{props.noMatchesLabel}</p>}
          >
            <ul class="max-h-56 overflow-y-auto p-1">
              <For each={filteredOptions()}>
                {(option) => (
                  <li>
                    <button
                      type="button"
                      class={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] transition-colors ${
                        isOptionSelected(option)
                          ? 'bg-slate-100 text-slate-800'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                      onClick={(event) => handleOptionSelect(event, option)}
                    >
                      <span class="min-w-0 flex-1 truncate">{option.label}</span>
                      <span class="shrink-0 tabular-nums text-[11px] text-slate-400">
                        {option.count}
                      </span>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Show>
      </div>
    </details>
  )
}

export function DashboardProcessFiltersBar(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  const providerOptions = (): readonly FilterControlOption<string>[] => {
    return props.providers.map((provider) => ({
      value: provider.value,
      label: provider.value,
      count: provider.count,
    }))
  }

  const statusOptions = (): readonly FilterControlOption<TrackingStatusCode>[] => {
    return props.statuses.map((status) => ({
      value: status.value,
      label: t(trackingStatusToLabelKey(keys, status.value)),
      count: status.count,
    }))
  }

  const hasActiveFilters = () => {
    return (
      props.selectedProviders.length > 0 ||
      props.selectedStatuses.length > 0 ||
      props.selectedImporterId !== null ||
      props.selectedImporterName !== null
    )
  }

  return (
    <section class="mb-3 rounded border border-slate-200 bg-white px-3 py-2">
      <div class="flex flex-col gap-2 md:flex-row md:items-start">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {t(keys.dashboard.filters.title)}
        </span>
        <div class="grid flex-1 gap-2 md:grid-cols-3">
          <MultiSelectFilterControl
            label={t(keys.dashboard.filters.provider.label)}
            allLabel={t(keys.dashboard.filters.provider.all)}
            emptyLabel={t(keys.dashboard.filters.provider.empty)}
            testId="dashboard-provider-filter"
            selectedValues={props.selectedProviders}
            options={providerOptions()}
            onToggle={props.onProviderToggle}
            toSelectedCountLabel={(count) => t(keys.dashboard.filters.selectedCount, { count })}
          />
          <MultiSelectFilterControl
            label={t(keys.dashboard.filters.status.label)}
            allLabel={t(keys.dashboard.filters.status.all)}
            emptyLabel={t(keys.dashboard.filters.status.empty)}
            testId="dashboard-status-filter"
            selectedValues={props.selectedStatuses}
            options={statusOptions()}
            onToggle={props.onStatusToggle}
            toSelectedCountLabel={(count) => t(keys.dashboard.filters.selectedCount, { count })}
          />
          <ImporterFilterControl
            label={t(keys.dashboard.filters.importer.label)}
            allLabel={t(keys.dashboard.filters.importer.all)}
            emptyLabel={t(keys.dashboard.filters.importer.empty)}
            searchPlaceholder={t(keys.dashboard.filters.importer.searchPlaceholder)}
            noMatchesLabel={t(keys.dashboard.filters.importer.noMatches)}
            testId="dashboard-importer-filter"
            options={props.importers}
            selectedImporterId={props.selectedImporterId}
            selectedImporterName={props.selectedImporterName}
            onSelect={props.onImporterSelect}
          />
        </div>
        <button
          type="button"
          class="self-start rounded border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
          onClick={() => props.onClearAllFilters()}
          disabled={!hasActiveFilters()}
        >
          {t(keys.dashboard.filters.clearAll)}
        </button>
      </div>
    </section>
  )
}
