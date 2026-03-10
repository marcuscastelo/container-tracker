import type { JSX } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { ActiveFiltersPanel } from '~/modules/process/ui/components/unified/ActiveFiltersPanel'
import type { FilterControlOption } from '~/modules/process/ui/components/unified/FilterControlOption'
import { ImporterChipDropdown } from '~/modules/process/ui/components/unified/ImporterChipDropdown'
import { MultiSelectChipDropdown } from '~/modules/process/ui/components/unified/MultiSelectChipDropdown'
import { SingleSelectChipDropdown } from '~/modules/process/ui/components/unified/SingleSelectChipDropdown'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type {
  DashboardImporterFilterOption,
  DashboardImporterFilterValue,
  DashboardProviderFilterOption,
  DashboardSeverityFilterOption,
  DashboardSeverityFilterValue,
  DashboardStatusFilterOption,
} from '~/modules/process/ui/viewmodels/dashboard-filter.service'
import { hasActiveDashboardFilters } from '~/modules/process/ui/viewmodels/dashboard-filter.service'
import type { ProcessStatusCode } from '~/modules/process/ui/process-status-color'
import { useTranslation } from '~/shared/localization/i18n'

// ─── Types ────────────────────────────────────────────────────────────────────
type Props = {
  readonly providers: readonly DashboardProviderFilterOption[]
  readonly statuses: readonly DashboardStatusFilterOption[]
  readonly importers: readonly DashboardImporterFilterOption[]
  readonly severities: readonly DashboardSeverityFilterOption[]
  readonly selectedProviders: readonly string[]
  readonly selectedStatuses: readonly ProcessStatusCode[]
  readonly selectedImporterId: string | null
  readonly selectedImporterName: string | null
  readonly selectedSeverity: DashboardSeverityFilterValue | null
  readonly onProviderToggle: (provider: string) => void
  readonly onStatusToggle: (status: ProcessStatusCode) => void
  readonly onImporterSelect: (importer: DashboardImporterFilterValue | null) => void
  readonly onSeveritySelect: (severity: DashboardSeverityFilterValue | null) => void
  readonly onClearAllFilters: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toOptionalNonBlankString(value: string | null): string | null {
  if (value === null) return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  return trimmed
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
export function UnifiedDashboardFilters(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const statusOptions = (): readonly FilterControlOption<ProcessStatusCode>[] =>
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

  const providerOptions = (): readonly FilterControlOption<string>[] =>
    props.providers.map((provider) => ({
      value: provider.value,
      label: provider.value,
      count: provider.count,
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
          {
            <button
              type="button"
              class="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-md-ui text-slate-500 transition-colors hover:text-slate-700"
              onClick={() => props.onClearAllFilters()}
              data-testid="dashboard-clear-filters"
            >
              <ClearIcon />
              <span>{t(keys.dashboard.filters.clearAll)}</span>
            </button>
          }
        </Show>
      </div>

      <Show when={hasActiveFilters()}>
        {
          <ActiveFiltersPanel
            selectedSeverity={props.selectedSeverity}
            selectedProviders={props.selectedProviders}
            selectedStatuses={props.selectedStatuses}
            selectedImporterChipLabel={selectedImporterChipLabel() ?? null}
            onSeveritySelect={props.onSeveritySelect}
            onProviderToggle={props.onProviderToggle}
            onStatusToggle={props.onStatusToggle}
            onImporterSelect={props.onImporterSelect}
          />
        }
      </Show>
    </section>
  )
}
