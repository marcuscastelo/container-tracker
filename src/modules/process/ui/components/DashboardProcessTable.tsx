import { A } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type {
  DashboardSortDirection,
  DashboardSortField,
  DashboardSortSelection,
} from '~/modules/process/ui/viewmodels/dashboard-sort.vm'
import { getActiveDashboardSortDirection } from '~/modules/process/ui/viewmodels/dashboard-sort-interaction.vm'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { EmptyState } from '~/shared/ui/EmptyState'
import { StatusBadge } from '~/shared/ui/StatusBadge'
import { formatDateForLocale } from '~/shared/utils/formatDate'

type DashboardProcessSeverity = 'danger' | 'warning' | 'info' | 'success' | 'none'
type SeverityFilter = 'all' | 'danger' | 'warning'

type Props = {
  readonly processes: readonly ProcessSummaryVM[]
  readonly loading: boolean
  readonly hasError: boolean
  readonly hasActiveFilters: boolean
  readonly onCreateProcess: () => void
  readonly onClearFilters: () => void
  readonly sortSelection: DashboardSortSelection
  readonly onSortToggle: (field: DashboardSortField) => void
}

type RowProps = {
  readonly process: ProcessSummaryVM
}

type TableRowsProps = {
  readonly processes: readonly ProcessSummaryVM[]
  readonly sortSelection: DashboardSortSelection
  readonly onSortToggle: (field: DashboardSortField) => void
}

type SortHeaderProps = {
  readonly field: DashboardSortField
  readonly label: string
  readonly direction: DashboardSortDirection | null
  readonly onToggle: (field: DashboardSortField) => void
  readonly align?: 'left' | 'right'
}

function ArrowIcon(): JSX.Element {
  return (
    <svg
      class="h-3 w-3 text-slate-300"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M17 8l4 4m0 0l-4 4m4-4H3"
      />
    </svg>
  )
}

function toAriaSort(direction: DashboardSortDirection | null): 'none' | 'ascending' | 'descending' {
  if (direction === 'asc') return 'ascending'
  if (direction === 'desc') return 'descending'
  return 'none'
}

function SortDirectionIcon(props: { readonly direction: DashboardSortDirection | null }): JSX.Element {
  const arrow = () => (props.direction === 'asc' ? '↑' : '↓')

  return (
    <Show when={props.direction !== null}>
      <span
        class="inline-flex h-4 w-4 items-center justify-center text-[11px] leading-none text-slate-600"
        aria-hidden="true"
      >
        {arrow()}
      </span>
    </Show>
  )
}

function SortHeaderButton(props: SortHeaderProps): JSX.Element {
  const isActive = () => props.direction !== null
  const justifyClass = () => (props.align === 'right' ? 'justify-end' : 'justify-start')

  return (
    <button
      type="button"
      class={`inline-flex w-full items-center ${justifyClass()} gap-1 transition-colors focus-visible:outline-none ${
        isActive() ? 'text-slate-700' : 'hover:text-slate-600 focus-visible:text-slate-700'
      }`}
      onClick={() => props.onToggle(props.field)}
    >
      <span>{props.label}</span>
      <SortDirectionIcon direction={props.direction} />
    </button>
  )
}

function displayProcessRef(process: ProcessSummaryVM): string {
  if (process.reference) return process.reference
  return `<${process.id.slice(0, 8)}>`
}

function displayRoute(process: ProcessSummaryVM): {
  origin: string
  destination: string
} {
  return {
    origin: process.origin?.display_name ?? '—',
    destination: process.destination?.display_name ?? '—',
  }
}

function displayEta(eta: string | null): string {
  if (!eta) return '—'
  return formatDateForLocale(eta)
}

function toDominantSeverity(process: ProcessSummaryVM): DashboardProcessSeverity {
  const highestSeverity = process.highestAlertSeverity
  if (highestSeverity === 'danger') return 'danger'
  if (highestSeverity === 'warning') return 'warning'
  if (highestSeverity === 'info') return 'info'
  if (process.alertsCount > 0) return 'info'
  return 'none'
}

function toSeverityBadgeClasses(severity: DashboardProcessSeverity): string {
  if (severity === 'danger') return 'border-red-200 bg-red-50 text-red-700'
  if (severity === 'warning') return 'border-yellow-200 bg-yellow-50 text-yellow-700'
  if (severity === 'info') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (severity === 'success') return 'border-green-200 bg-green-50 text-green-700'
  return 'border-slate-200 bg-slate-50 text-slate-500'
}

function getSeverityStripClass(severity: DashboardProcessSeverity): string {
  if (severity === 'danger') return 'bg-red-500'
  if (severity === 'warning') return 'bg-yellow-400'
  return 'bg-slate-200'
}

function DashboardProcessRow(props: RowProps): JSX.Element {
  const { t, keys } = useTranslation()
  const route = () => displayRoute(props.process)

  function formatAge(ts: string | Date | null | undefined): string {
    if (!ts) return t(keys.dashboard.table.age.missing)
    const date = typeof ts === 'string' ? new Date(ts) : ts
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—'
    const diff = Date.now() - date.getTime()
    const s = Math.floor(diff / 1000)
    if (s < 60) return t(keys.dashboard.table.age.now)
    const m = Math.floor(s / 60)
    if (m < 60) return t(keys.dashboard.table.age.minutes, { count: m })
    const h = Math.floor(m / 60)
    if (h < 24) return t(keys.dashboard.table.age.hours, { count: h })
    const d = Math.floor(h / 24)
    return t(keys.dashboard.table.age.days, { count: d })
  }

  const dominantSeverity = () => toDominantSeverity(props.process)

  const severityLabel = () => {
    if (dominantSeverity() === 'danger') {
      return t(keys.dashboard.alertIndicators.severity.danger)
    }
    if (dominantSeverity() === 'warning') {
      return t(keys.dashboard.alertIndicators.severity.warning)
    }
    if (dominantSeverity() === 'info') {
      return t(keys.dashboard.alertIndicators.severity.info)
    }
    if (dominantSeverity() === 'success') {
      return t(keys.dashboard.alertIndicators.severity.success)
    }
    return t(keys.dashboard.table.severity.none)
  }

  return (
    <tr class="group relative border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/80">
      <td class="p-0 w-0">
        <div class={`absolute left-0 top-0 bottom-0 w-1 ${getSeverityStripClass(dominantSeverity())}`} />
      </td>
      <td class="px-4 py-2.5">
        <A
          href={`/shipments/${props.process.id}`}
          class="text-[13px] font-semibold text-slate-900 hover:text-blue-600 hover:underline"
        >
          {displayProcessRef(props.process)}
        </A>
      </td>
      <td class="px-4 py-2.5">
        <div class="flex items-center gap-1.5 text-[13px] text-slate-600">
          <span class="max-w-[120px] truncate">{route().origin}</span>
          <ArrowIcon />
          <span class="max-w-[120px] truncate">{route().destination}</span>
        </div>
      </td>
      <td class="px-4 py-2.5">
        <StatusBadge
          variant={props.process.status}
          neutral={true}
          label={t(trackingStatusToLabelKey(keys, props.process.statusCode))}
        />
      </td>
      <td class="px-4 py-2.5 text-right">
        <Show when={props.process.eta} fallback={<span class="text-[13px] text-slate-300">—</span>}>
          <span class="text-[13px] tabular-nums text-slate-600">{displayEta(props.process.eta)}</span>
        </Show>
      </td>
      <td class="px-4 py-2.5">
        <span
          class={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${toSeverityBadgeClasses(
            dominantSeverity(),
          )}`}
        >
          {severityLabel()}
        </span>
      </td>
      <td class="px-4 py-2.5 text-center">
        <div class="flex flex-col items-center gap-1">
          <span class="inline-flex h-5 min-w-5 items-center justify-center rounded bg-slate-100 px-1.5 text-[11px] font-bold tabular-nums text-slate-700">
            {props.process.alertsCount}
          </span>
          <span class="text-[11px] text-slate-400">{formatAge(props.process.lastEventAt)}</span>
        </div>
      </td>
    </tr>
  )
}

function DashboardProcessRows(props: TableRowsProps): JSX.Element {
  const { t, keys } = useTranslation()

  const processSortDirection = () =>
    getActiveDashboardSortDirection(props.sortSelection, 'processNumber')
  const statusSortDirection = () => getActiveDashboardSortDirection(props.sortSelection, 'status')
  const etaSortDirection = () => getActiveDashboardSortDirection(props.sortSelection, 'eta')

  return (
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <th class="p-0 w-0" />
            <th class="px-4 py-2" aria-sort={toAriaSort(processSortDirection())}>
              <SortHeaderButton
                field="processNumber"
                label={t(keys.dashboard.table.col.process)}
                direction={processSortDirection()}
                onToggle={props.onSortToggle}
              />
            </th>
            <th class="px-4 py-2">{t(keys.dashboard.table.col.route)}</th>
            <th class="px-4 py-2" aria-sort={toAriaSort(statusSortDirection())}>
              <SortHeaderButton
                field="status"
                label={t(keys.dashboard.table.col.status)}
                direction={statusSortDirection()}
                onToggle={props.onSortToggle}
              />
            </th>
            <th class="px-4 py-2 text-right" aria-sort={toAriaSort(etaSortDirection())}>
              <SortHeaderButton
                field="eta"
                label={t(keys.dashboard.table.col.eta)}
                direction={etaSortDirection()}
                onToggle={props.onSortToggle}
                align="right"
              />
            </th>
            <th class="px-4 py-2">{t(keys.dashboard.table.col.dominantSeverity)}</th>
            <th class="px-4 py-2 text-center">{t(keys.dashboard.table.col.activeAlerts)}</th>
          </tr>
        </thead>
        <tbody>
          <For each={props.processes}>{(process) => <DashboardProcessRow process={process} />}</For>
        </tbody>
      </table>
    </div>
  )
}

export function DashboardProcessTable(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  const [selectedSeverity, setSelectedSeverity] = createSignal<SeverityFilter>('all')

  const filteredBySeverity = () => {
    if (selectedSeverity() === 'all') return props.processes
    return props.processes.filter((process) => toDominantSeverity(process) === selectedSeverity())
  }

  const hasAnyActiveFilters = () => props.hasActiveFilters || selectedSeverity() !== 'all'

  const clearAllFilters = () => {
    setSelectedSeverity('all')
    props.onClearFilters()
  }

  const content = () => {
    if (props.loading) {
      return (
        <div class="px-4 py-8 text-center text-[13px] text-slate-400">{t(keys.dashboard.loading)}</div>
      )
    }

    if (props.hasError) {
      return (
        <div class="px-4 py-8 text-center text-[13px] text-red-500">
          {t(keys.dashboard.error.loadProcesses)}
        </div>
      )
    }

    if (filteredBySeverity().length === 0) {
      if (hasAnyActiveFilters()) {
        return (
          <EmptyState
            title={t(keys.dashboard.empty.filtered.title)}
            description={t(keys.dashboard.empty.filtered.description)}
            actionLabel={t(keys.dashboard.empty.filtered.action)}
            onAction={clearAllFilters}
          />
        )
      }

      return (
        <EmptyState
          title={t(keys.dashboard.empty.title)}
          description={t(keys.dashboard.empty.description)}
          actionLabel={t(keys.dashboard.empty.action)}
          onAction={props.onCreateProcess}
        />
      )
    }

    return (
      <div>
        <div class="flex items-center gap-2 px-4 py-3">
          <div class="text-[13px] font-semibold text-slate-700">{t(keys.dashboard.table.filters.title)}</div>
          <div class="flex gap-2">
            <button
              class={`px-3 py-1 text-[13px] rounded-full ${selectedSeverity() === 'all' ? 'bg-slate-100' : 'bg-white'}`}
              type="button"
              onClick={() => setSelectedSeverity('all')}
              aria-pressed={selectedSeverity() === 'all'}
            >
              {t(keys.dashboard.table.filters.all)}
            </button>
            <button
              class={`px-3 py-1 text-[13px] rounded-full ${selectedSeverity() === 'danger' ? 'bg-red-100' : 'bg-white'}`}
              type="button"
              onClick={() => setSelectedSeverity('danger')}
              aria-pressed={selectedSeverity() === 'danger'}
            >
              {t(keys.dashboard.table.filters.danger)}
            </button>
            <button
              class={`px-3 py-1 text-[13px] rounded-full ${selectedSeverity() === 'warning' ? 'bg-yellow-100' : 'bg-white'}`}
              type="button"
              onClick={() => setSelectedSeverity('warning')}
              aria-pressed={selectedSeverity() === 'warning'}
            >
              {t(keys.dashboard.table.filters.warning)}
            </button>
          </div>
          <div class="ml-auto text-[13px] text-slate-500">
            {filteredBySeverity().length} / {props.processes.length}
          </div>
        </div>

        <DashboardProcessRows
          processes={filteredBySeverity()}
          sortSelection={props.sortSelection}
          onSortToggle={props.onSortToggle}
        />
      </div>
    )
  }

  return (
    <section class="overflow-hidden rounded border border-slate-200 bg-white">
      <header class="border-b border-slate-200 px-4 py-2.5">
        <h2 class="text-[13px] font-semibold text-slate-900">{t(keys.dashboard.table.title)}</h2>
      </header>
      {content()}
    </section>
  )
}
