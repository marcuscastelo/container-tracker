import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { ActiveFilterChip } from '~/modules/process/ui/components/unified/ActiveFilterChip'
import { processStatusToLabelKey } from '~/modules/process/ui/mappers/processStatus.ui-mapper'
import type { ProcessStatusCode } from '~/modules/process/ui/process-status-color'
import type {
  DashboardImporterFilterValue,
  DashboardSeverityFilterValue,
} from '~/modules/process/ui/viewmodels/dashboard-filter.service'
import { useTranslation } from '~/shared/localization/i18n'

type Props = {
  readonly selectedSeverity: string | null
  readonly selectedProviders: readonly string[]
  readonly selectedStatuses: readonly ProcessStatusCode[]
  readonly selectedImporterChipLabel: string | null
  readonly onSeveritySelect: (severity: DashboardSeverityFilterValue | null) => void
  readonly onProviderToggle: (provider: string) => void
  readonly onStatusToggle: (status: ProcessStatusCode) => void
  readonly onImporterSelect: (importer: DashboardImporterFilterValue | null) => void
}

export function ActiveFiltersPanel(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  function severityLabel(value: string | null): string {
    if (value === 'danger') return t(keys.dashboard.filters.severity.danger)
    if (value === 'warning') return t(keys.dashboard.filters.severity.warning)
    return t(keys.dashboard.filters.severity.none)
  }

  return (
    <div
      class="mt-2 flex flex-wrap items-center gap-1.5"
      data-testid="dashboard-active-filter-chips"
    >
      <span class="text-sm-ui font-semibold uppercase tracking-wide text-text-muted">
        {t(keys.dashboard.filters.active)}
      </span>
      <Show when={props.selectedSeverity !== null}>
        <ActiveFilterChip
          label={`${t(keys.dashboard.filters.severity.label)}: ${severityLabel(props.selectedSeverity)}`}
          ariaLabel={t(keys.dashboard.filters.removeChip, {
            filter: `${t(keys.dashboard.filters.severity.label)}: ${severityLabel(props.selectedSeverity)}`,
          })}
          onRemove={() => props.onSeveritySelect(null)}
        />
      </Show>

      <For each={props.selectedProviders}>
        {(provider) => (
          <ActiveFilterChip
            label={`${t(keys.dashboard.filters.provider.label)}: ${provider}`}
            ariaLabel={t(keys.dashboard.filters.removeChip, {
              filter: `${t(keys.dashboard.filters.provider.label)}: ${provider}`,
            })}
            onRemove={() => props.onProviderToggle(provider)}
          />
        )}
      </For>

      <For each={props.selectedStatuses}>
        {(status) => (
          <ActiveFilterChip
            label={`${t(keys.dashboard.filters.status.label)}: ${t(processStatusToLabelKey(keys, status))}`}
            ariaLabel={t(keys.dashboard.filters.removeChip, {
              filter: `${t(keys.dashboard.filters.status.label)}: ${t(processStatusToLabelKey(keys, status))}`,
            })}
            onRemove={() => props.onStatusToggle(status)}
          />
        )}
      </For>
      <Show when={props.selectedImporterChipLabel !== null}>
        <ActiveFilterChip
          label={`${t(keys.dashboard.filters.importer.label)}: ${props.selectedImporterChipLabel}`}
          ariaLabel={t(keys.dashboard.filters.removeChip, {
            filter: `${t(keys.dashboard.filters.importer.label)}: ${props.selectedImporterChipLabel}`,
          })}
          onRemove={() => props.onImporterSelect(null)}
        />
      </Show>
    </div>
  )
}
