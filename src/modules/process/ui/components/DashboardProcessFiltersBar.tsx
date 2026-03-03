import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type {
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
  readonly selectedProviders: readonly string[]
  readonly selectedStatuses: readonly TrackingStatusCode[]
  readonly onProviderToggle: (provider: string) => void
  readonly onStatusToggle: (status: TrackingStatusCode) => void
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

  return (
    <section class="mb-3 rounded border border-slate-200 bg-white px-3 py-2">
      <div class="flex flex-col gap-2 md:flex-row md:items-center">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {t(keys.dashboard.filters.title)}
        </span>
        <div class="grid flex-1 gap-2 md:grid-cols-2">
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
        </div>
      </div>
    </section>
  )
}
