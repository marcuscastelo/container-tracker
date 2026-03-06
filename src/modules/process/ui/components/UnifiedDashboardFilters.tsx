import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type {
  DashboardImporterFilterOption,
  DashboardImporterFilterValue,
  DashboardProviderFilterOption,
  DashboardSeverityFilterOption,
  DashboardSeverityFilterValue,
  DashboardStatusFilterOption,
} from '~/modules/process/ui/viewmodels/dashboard-filter-interaction.vm'
import { hasActiveDashboardFilters } from '~/modules/process/ui/viewmodels/dashboard-filter-interaction.vm'
import type { TrackingStatusCode } from '~/modules/tracking/application/projection/tracking.status.projection'
import { useTranslation } from '~/shared/localization/i18n'

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterControlOption<T extends string> = {
  readonly value: T
  readonly label: string
  readonly count: number
}

type Props = {
  readonly providers: readonly DashboardProviderFilterOption[]
  readonly statuses: readonly DashboardStatusFilterOption[]
  readonly importers: readonly DashboardImporterFilterOption[]
  readonly severities: readonly DashboardSeverityFilterOption[]
  readonly selectedProviders: readonly string[]
  readonly selectedStatuses: readonly TrackingStatusCode[]
  readonly selectedImporterId: string | null
  readonly selectedImporterName: string | null
  readonly selectedSeverity: DashboardSeverityFilterValue | null
  readonly onProviderToggle: (provider: string) => void
  readonly onStatusToggle: (status: TrackingStatusCode) => void
  readonly onImporterSelect: (importer: DashboardImporterFilterValue | null) => void
  readonly onSeveritySelect: (severity: DashboardSeverityFilterValue | null) => void
  readonly onClearAllFilters: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNormalizedNonBlankString(value: string | null): string | null {
  if (value === null) return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  return trimmed.toLocaleLowerCase('pt-BR')
}

function toOptionalNonBlankString(value: string | null): string | null {
  if (value === null) return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  return trimmed
}

function ChevronDownIcon(): JSX.Element {
  return (
    <svg
      class="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function ClearIcon(): JSX.Element {
  return (
    <svg
      class="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  )
}

// ─── Multi-Select Chip Dropdown (Carrier, Status) ────────────────────────────

function MultiSelectChipDropdown<T extends string>(props: {
  readonly label: string
  readonly allLabel: string
  readonly emptyLabel: string
  readonly testId: string
  readonly selectedValues: readonly T[]
  readonly options: readonly FilterControlOption<T>[]
  readonly onToggle: (value: T) => void
  readonly toSelectedCountLabel: (count: number) => string
}): JSX.Element {
  const selectedCount = () => props.selectedValues.length
  const isSelected = (value: T): boolean => props.selectedValues.some((v) => v === value)

  const hasSelection = () => selectedCount() > 0

  const chipLabel = () => {
    if (props.options.length === 0) return props.label
    if (!hasSelection()) return props.label
    if (selectedCount() === 1) {
      const selected = props.options.find((o) => isSelected(o.value))
      return selected ? `${props.label}: ${selected.label}` : props.label
    }
    return `${props.label}: ${props.toSelectedCountLabel(selectedCount())}`
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

      <div class="absolute left-0 top-full z-20 mt-1 min-w-55 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
        <Show
          when={props.options.length > 0}
          fallback={<p class="px-3 py-2 text-[13px] text-slate-500">{props.emptyLabel}</p>}
        >
          <ul class="max-h-56 overflow-y-auto p-1">
            <For each={props.options}>
              {(option) => (
                <li>
                  <label class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50">
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

// ─── Single-Select Chip Dropdown (Severity) ──────────────────────────────────

function SingleSelectChipDropdown<T extends string>(props: {
  readonly label: string
  readonly allLabel: string
  readonly testId: string
  readonly selectedValue: T | null
  readonly options: readonly FilterControlOption<T>[]
  readonly onSelect: (value: T | null) => void
  readonly toOptionLabel: (value: T) => string
}): JSX.Element {
  const hasSelection = () => props.selectedValue !== null

  const chipLabel = () => {
    if (!hasSelection()) return props.label
    const selected = props.options.find((o) => o.value === props.selectedValue)
    return selected ? `${props.label}: ${selected.label}` : props.label
  }

  const handleSelect = (
    event: MouseEvent & { readonly currentTarget: HTMLButtonElement },
    value: T | null,
  ) => {
    props.onSelect(value)
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

      <div class="absolute left-0 top-full z-20 mt-1 min-w-50 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
        <ul class="max-h-56 overflow-y-auto p-1">
          <li>
            <button
              type="button"
              class={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] transition-colors ${
                hasSelection() ? 'text-slate-700 hover:bg-slate-50' : 'bg-slate-100 text-slate-800'
              }`}
              onClick={(event) => handleSelect(event, null)}
            >
              <span class="min-w-0 flex-1 truncate">{props.allLabel}</span>
            </button>
          </li>
          <For each={props.options}>
            {(option) => (
              <li>
                <button
                  type="button"
                  class={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] transition-colors ${
                    props.selectedValue === option.value
                      ? 'bg-slate-100 text-slate-800'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={(event) => handleSelect(event, option.value)}
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
      </div>
    </details>
  )
}

// ─── Importer Chip Dropdown (single-select with search) ──────────────────────

function ImporterChipDropdown(props: {
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
        <Show when={props.options.length === 0}>
          <p class="px-3 py-2 text-[13px] text-slate-500">{props.emptyLabel}</p>
        </Show>
        <Show when={props.options.length > 0 && filteredOptions().length === 0}>
          <p class="px-3 py-2 text-[13px] text-slate-500">{props.noMatchesLabel}</p>
        </Show>
        <Show when={props.options.length > 0 && filteredOptions().length > 0}>
          <ul class="max-h-56 overflow-y-auto p-1">
            <For each={filteredOptions()}>
              {(option) => (
                <li>
                  <button
                    type="button"
                    class={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] transition-colors ${
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
      </div>
    </details>
  )
}

// ─── Active Filter Chips ─────────────────────────────────────────────────────

function ActiveFilterChip(props: {
  readonly label: string
  readonly ariaLabel: string
  readonly onRemove: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[12px] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-200"
      aria-label={props.ariaLabel}
      onClick={() => props.onRemove()}
    >
      <span>{props.label}</span>
      <span aria-hidden="true">×</span>
    </button>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function UnifiedDashboardFilters(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  const providerOptions = (): readonly FilterControlOption<string>[] =>
    props.providers.map((provider) => ({
      value: provider.value,
      label: provider.value,
      count: provider.count,
    }))

  const statusOptions = (): readonly FilterControlOption<TrackingStatusCode>[] =>
    props.statuses.map((status) => ({
      value: status.value,
      label: t(trackingStatusToLabelKey(keys, status.value)),
      count: status.count,
    }))

  const severityOptions = (): readonly FilterControlOption<DashboardSeverityFilterValue>[] =>
    props.severities.map((severity) => ({
      value: severity.value,
      label: toSeverityLabel(severity.value),
      count: severity.count,
    }))

  function toSeverityLabel(value: DashboardSeverityFilterValue): string {
    if (value === 'danger') return t(keys.dashboard.filters.severity.danger)
    if (value === 'warning') return t(keys.dashboard.filters.severity.warning)
    return t(keys.dashboard.filters.severity.none)
  }

  const activeFilters = () => ({
    providers: props.selectedProviders,
    statuses: props.selectedStatuses,
    importerId: props.selectedImporterId,
    importerName: props.selectedImporterName,
    severity: props.selectedSeverity,
  })
  const hasActiveFilters = () => hasActiveDashboardFilters(activeFilters())

  const selectedImporterChipLabel = createMemo(() => {
    const selectedImporterId = toOptionalNonBlankString(props.selectedImporterId)
    if (selectedImporterId !== null) {
      const matchedOption = props.importers.find(
        (option) => option.importerId === selectedImporterId,
      )
      if (matchedOption) return matchedOption.label

      const selectedImporterName = toOptionalNonBlankString(props.selectedImporterName)
      if (selectedImporterName !== null && selectedImporterName !== selectedImporterId) {
        return `${selectedImporterName} (${selectedImporterId})`
      }
      return selectedImporterId
    }
    return toOptionalNonBlankString(props.selectedImporterName)
  })

  return (
    <section class="mb-3" data-testid="unified-dashboard-filters">
      <div class="flex flex-wrap items-center gap-2">
        <SingleSelectChipDropdown
          label={t(keys.dashboard.filters.severity.label)}
          allLabel={t(keys.dashboard.filters.severity.all)}
          testId="dashboard-severity-filter"
          selectedValue={props.selectedSeverity}
          options={severityOptions()}
          onSelect={props.onSeveritySelect}
          toOptionLabel={toSeverityLabel}
        />

        <MultiSelectChipDropdown
          label={t(keys.dashboard.filters.provider.label)}
          allLabel={t(keys.dashboard.filters.provider.all)}
          emptyLabel={t(keys.dashboard.filters.provider.empty)}
          testId="dashboard-provider-filter"
          selectedValues={props.selectedProviders}
          options={providerOptions()}
          onToggle={props.onProviderToggle}
          toSelectedCountLabel={(count) => t(keys.dashboard.filters.selectedCount, { count })}
        />

        <MultiSelectChipDropdown
          label={t(keys.dashboard.filters.status.label)}
          allLabel={t(keys.dashboard.filters.status.all)}
          emptyLabel={t(keys.dashboard.filters.status.empty)}
          testId="dashboard-status-filter"
          selectedValues={props.selectedStatuses}
          options={statusOptions()}
          onToggle={props.onStatusToggle}
          toSelectedCountLabel={(count) => t(keys.dashboard.filters.selectedCount, { count })}
        />

        <ImporterChipDropdown
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

        <Show when={hasActiveFilters()}>
          <button
            type="button"
            class="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-slate-500 transition-colors hover:text-slate-700"
            onClick={() => props.onClearAllFilters()}
            data-testid="dashboard-clear-filters"
          >
            <ClearIcon />
            <span>{t(keys.dashboard.filters.clearAll)}</span>
          </button>
        </Show>
      </div>

      <Show when={hasActiveFilters()}>
        <div
          class="mt-2 flex flex-wrap items-center gap-1.5"
          data-testid="dashboard-active-filter-chips"
        >
          <span class="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
            {t(keys.dashboard.filters.active)}
          </span>

          <Show when={props.selectedSeverity}>
            {(severity) => {
              const label = () =>
                `${t(keys.dashboard.filters.severity.label)}: ${toSeverityLabel(severity())}`
              return (
                <ActiveFilterChip
                  label={label()}
                  ariaLabel={t(keys.dashboard.filters.removeChip, { filter: label() })}
                  onRemove={() => props.onSeveritySelect(null)}
                />
              )
            }}
          </Show>

          <For each={props.selectedProviders}>
            {(provider) => {
              const label = () => `${t(keys.dashboard.filters.provider.label)}: ${provider}`
              return (
                <ActiveFilterChip
                  label={label()}
                  ariaLabel={t(keys.dashboard.filters.removeChip, { filter: label() })}
                  onRemove={() => props.onProviderToggle(provider)}
                />
              )
            }}
          </For>

          <For each={props.selectedStatuses}>
            {(status) => {
              const label = () =>
                `${t(keys.dashboard.filters.status.label)}: ${t(trackingStatusToLabelKey(keys, status))}`
              return (
                <ActiveFilterChip
                  label={label()}
                  ariaLabel={t(keys.dashboard.filters.removeChip, { filter: label() })}
                  onRemove={() => props.onStatusToggle(status)}
                />
              )
            }}
          </For>

          <Show when={selectedImporterChipLabel()}>
            {(label) => {
              const chipLabel = () => `${t(keys.dashboard.filters.importer.label)}: ${label()}`
              return (
                <ActiveFilterChip
                  label={chipLabel()}
                  ariaLabel={t(keys.dashboard.filters.removeChip, { filter: chipLabel() })}
                  onRemove={() => props.onImporterSelect(null)}
                />
              )
            }}
          </Show>
        </div>
      </Show>
    </section>
  )
}
