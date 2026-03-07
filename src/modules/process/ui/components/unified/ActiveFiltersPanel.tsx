import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { ActiveFilterChip } from '~/modules/process/ui/components/unified/ActiveFilterChip'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type { TrackingStatusCode } from '~/modules/tracking/application/projection/tracking.status.projection'
import { useTranslation } from '~/shared/localization/i18n'

type Props = {
  readonly selectedSeverity: string | null
  readonly selectedProviders: readonly string[]
  readonly selectedStatuses: readonly TrackingStatusCode[]
  readonly selectedImporterChipLabel: string | null
  readonly onSeveritySelect: (severity: unknown) => void
  readonly onProviderToggle: (provider: string) => void
  readonly onStatusToggle: (status: TrackingStatusCode) => void
  readonly onImporterSelect: (importer: unknown) => void
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
      <span class="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
        {t(keys.dashboard.filters.active)}
      </span>

      {props.selectedSeverity ? (
        <ActiveFilterChip
          label={`${t(keys.dashboard.filters.severity.label)}: ${severityLabel(props.selectedSeverity)}`}
          ariaLabel={t(keys.dashboard.filters.removeChip, {
            filter: `${t(keys.dashboard.filters.severity.label)}: ${severityLabel(props.selectedSeverity)}`,
          })}
          onRemove={() => props.onSeveritySelect(null)}
        />
      ) : null}

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
            label={`${t(keys.dashboard.filters.status.label)}: ${t(trackingStatusToLabelKey(keys, status))}`}
            ariaLabel={t(keys.dashboard.filters.removeChip, {
              filter: `${t(keys.dashboard.filters.status.label)}: ${t(trackingStatusToLabelKey(keys, status))}`,
            })}
            onRemove={() => props.onStatusToggle(status)}
          />
        )}
      </For>

      {props.selectedImporterChipLabel ? (
        <ActiveFilterChip
          label={`${t(keys.dashboard.filters.importer.label)}: ${props.selectedImporterChipLabel}`}
          ariaLabel={t(keys.dashboard.filters.removeChip, {
            filter: `${t(keys.dashboard.filters.importer.label)}: ${props.selectedImporterChipLabel}`,
          })}
          onRemove={() => props.onImporterSelect(null)}
        />
      ) : null}
    </div>
  )
}
