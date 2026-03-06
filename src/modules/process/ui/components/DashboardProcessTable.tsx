import { A, useNavigate } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { ProcessSyncButton } from '~/modules/process/ui/components/ProcessSyncButton'
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
  readonly onProcessSync: (processId: string) => Promise<void>
}

type RowProps = {
  readonly process: ProcessSummaryVM
  readonly index: number
  readonly onProcessSync: (processId: string) => Promise<void>
}

type TableRowsProps = {
  readonly processes: readonly ProcessSummaryVM[]
  readonly sortSelection: DashboardSortSelection
  readonly onSortToggle: (field: DashboardSortField) => void
  readonly onProcessSync: (processId: string) => Promise<void>
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

function SortDirectionIcon(props: {
  readonly direction: DashboardSortDirection | null
}): JSX.Element {
  const arrow = () => (props.direction === 'asc' ? '↑' : '↓')

  return (
    <Show when={props.direction !== null}>
      <span
        class="inline-flex h-4 w-4 items-center justify-center text-label leading-none text-slate-600"
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

function toDominantAlertLabel(
  process: ProcessSummaryVM,
  t: (key: string, opts?: Record<string, unknown>) => string,
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  if (process.alertsCount === 0) return t(keys.dashboard.table.dominantAlertLabel.noAlerts)
  if (process.hasTransshipment) return t(keys.dashboard.table.dominantAlertLabel.transshipment)
  return t(keys.dashboard.table.dominantAlertLabel.alertsPresent, { count: process.alertsCount })
}

type AlertCategoryChip = 'eta' | 'movement' | 'data' | 'customs'

function toDerivedCategories(process: ProcessSummaryVM): readonly AlertCategoryChip[] {
  const cats: AlertCategoryChip[] = []
  if (process.highestAlertSeverity === 'danger' || process.highestAlertSeverity === 'warning') {
    cats.push('eta')
  }
  if (process.hasTransshipment) {
    cats.push('movement')
  }
  if (process.alertsCount > 0 && cats.length === 0) {
    cats.push('data')
  }
  return cats
}

const MAX_VISIBLE_CHIPS = 2

const CATEGORY_ICON: Record<AlertCategoryChip, string> = {
  eta: '⏱',
  movement: '⇄',
  data: '🗄',
  customs: '🛃',
}

function toSeverityBadgeClasses(severity: DashboardProcessSeverity): string {
  if (severity === 'danger') return 'border-red-300 bg-red-100 text-red-800'
  if (severity === 'warning') return 'border-amber-300 bg-amber-100 text-amber-800'
  if (severity === 'info') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (severity === 'success') return 'border-green-200 bg-green-50 text-green-700'
  return 'border-slate-200 bg-slate-50 text-slate-500'
}

function getSeverityBorderClass(severity: DashboardProcessSeverity): string {
  if (severity === 'danger') return 'border-l-4 border-l-red-500'
  if (severity === 'warning') return 'border-l-4 border-l-amber-400'
  if (severity === 'info') return 'border-l-4 border-l-blue-300'
  return ''
}

function CheckIcon(): JSX.Element {
  return (
    <svg
      class="h-3 w-3 text-emerald-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function AlertChipList(props: {
  readonly chips: readonly AlertCategoryChip[]
  readonly overflowCount: number
  readonly overflowLabel: string
}): JSX.Element {
  return (
    <div class="flex items-center gap-1">
      <For each={props.chips}>
        {(chip) => (
          <span class="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-micro font-medium leading-none text-slate-500">
            <span aria-hidden="true">{CATEGORY_ICON[chip]}</span>
            {chip}
          </span>
        )}
      </For>
      <Show when={props.overflowCount > 0}>
        <span class="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-micro font-medium leading-none text-slate-400">
          {props.overflowLabel}
        </span>
      </Show>
    </div>
  )
}

function DashboardProcessRow(props: RowProps): JSX.Element {
  const { t, keys } = useTranslation()
  const navigate = useNavigate()
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
  const dominantAlertLabel = () => toDominantAlertLabel(props.process, t, keys)
  const categories = () => toDerivedCategories(props.process)
  const visibleChips = () => categories().slice(0, MAX_VISIBLE_CHIPS)
  const overflowCount = () => Math.max(0, categories().length - MAX_VISIBLE_CHIPS)

  const severityLabel = () => {
    if (dominantSeverity() === 'danger') {
      return t(keys.dashboard.alertIndicators.severity.danger).toUpperCase()
    }
    if (dominantSeverity() === 'warning') {
      return t(keys.dashboard.alertIndicators.severity.warning).toUpperCase()
    }
    if (dominantSeverity() === 'info') {
      return t(keys.dashboard.alertIndicators.severity.info).toUpperCase()
    }
    if (dominantSeverity() === 'success') {
      return t(keys.dashboard.alertIndicators.severity.success).toUpperCase()
    }
    return t(keys.dashboard.table.severity.none)
  }

  const ageLabel = () => formatAge(props.process.lastEventAt)

  const zebraClass = () => (props.index % 2 === 1 ? 'bg-gray-50' : 'bg-white')

  const handleRowClick = (e: MouseEvent) => {
    // Avoid double navigation when clicking inner links/buttons
    const target = e.target
    if (!(target instanceof HTMLElement)) return
    if (target.closest('a') || target.closest('button')) return
    navigate(`/shipments/${props.process.id}`)
  }

  return (
    <tr
      class={`group border-b border-slate-100 transition-colors last:border-b-0 cursor-pointer hover:bg-gray-50 ${zebraClass()} ${getSeverityBorderClass(dominantSeverity())}`}
      onClick={handleRowClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(`/shipments/${props.process.id}`)
      }}
    >
      {/* Severity + Age */}
      <td class="px-3 py-3">
        <Show
          when={dominantSeverity() !== 'none'}
          fallback={
            <div class="flex items-center gap-1">
              <CheckIcon />
              <span class="text-label text-slate-400">{severityLabel()}</span>
            </div>
          }
        >
          <div class="flex flex-col items-start gap-0.5">
            <span
              class={`inline-flex items-center rounded border px-1.5 py-0.5 text-micro font-bold uppercase tracking-wide leading-none ${toSeverityBadgeClasses(
                dominantSeverity(),
              )}`}
            >
              {severityLabel()}
            </span>
            <span class="text-micro tabular-nums text-slate-400">{ageLabel()}</span>
          </div>
        </Show>
      </td>
      <td class="px-3 py-3">
        <A
          href={`/shipments/${props.process.id}`}
          class="text-body font-bold text-blue-700 hover:text-blue-800 hover:underline"
        >
          {displayProcessRef(props.process)}
        </A>
      </td>
      <td class="px-3 py-3">
        <div class="flex items-center gap-1.5 text-body text-slate-700 leading-tight">
          <span class="max-w-[120px] truncate">{route().origin}</span>
          <ArrowIcon />
          <span class="max-w-[120px] truncate font-medium">{route().destination}</span>
          <Show when={props.process.redestinationNumber}>
            <span class="text-label text-slate-400">({props.process.redestinationNumber})</span>
          </Show>
        </div>
      </td>
      <td class="px-3 py-3">
        <StatusBadge
          variant={props.process.status}
          label={t(trackingStatusToLabelKey(keys, props.process.statusCode))}
        />
      </td>
      <td class="px-3 py-3 text-right">
        <Show when={props.process.eta} fallback={<span class="text-body text-slate-300">—</span>}>
          <span class="text-sm font-bold tabular-nums text-slate-900">
            {displayEta(props.process.eta)}
          </span>
        </Show>
      </td>
      <td class="px-3 py-3 text-center">
        <ProcessSyncButton
          processId={props.process.id}
          status={props.process.syncStatus}
          lastSyncAt={props.process.lastSyncAt}
          onSync={props.onProcessSync}
        />
      </td>
      {/* Dominant Alert — emphasized */}
      <td class="px-3 py-3">
        <div class="flex items-center gap-1.5">
          <span class="text-body font-medium text-slate-900 truncate max-w-[180px]">
            {dominantAlertLabel()}
          </span>
          <Show when={visibleChips().length > 0}>
            <AlertChipList
              chips={visibleChips()}
              overflowCount={overflowCount()}
              overflowLabel={t(keys.dashboard.table.chipOverflow, { count: overflowCount() })}
            />
          </Show>
        </div>
      </td>
      <td class="px-3 py-3 text-center">
        <span class="inline-flex h-5 min-w-5 items-center justify-center rounded bg-slate-100 px-1.5 text-label font-bold tabular-nums text-slate-700">
          {props.process.alertsCount}
        </span>
      </td>
    </tr>
  )
}

function GroupHeaderRow(props: {
  label: string
  rowClass: string
  labelClass: string
}): JSX.Element {
  return (
    <tr class={`border-b border-slate-100 ${props.rowClass}`}>
      <td colspan="8" class="px-3 py-1.5">
        <span class={`text-micro font-bold uppercase tracking-wider ${props.labelClass}`}>
          {props.label}
        </span>
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

  const exceptionsGroup = () => props.processes.filter((p) => toDominantSeverity(p) !== 'none')
  const normalGroup = () => props.processes.filter((p) => toDominantSeverity(p) === 'none')

  const tableHeader = (
    <thead>
      <tr class="border-b border-slate-200 text-left text-caption font-medium uppercase tracking-wider text-slate-400/80">
        <th class="px-3 py-2.5">{t(keys.dashboard.table.col.dominantSeverity)}</th>
        <th class="px-3 py-2.5" aria-sort={toAriaSort(processSortDirection())}>
          <SortHeaderButton
            field="processNumber"
            label={t(keys.dashboard.table.col.process)}
            direction={processSortDirection()}
            onToggle={props.onSortToggle}
          />
        </th>
        <th class="px-3 py-2.5">{t(keys.dashboard.table.col.route)}</th>
        <th class="px-3 py-2.5" aria-sort={toAriaSort(statusSortDirection())}>
          <SortHeaderButton
            field="status"
            label={t(keys.dashboard.table.col.status)}
            direction={statusSortDirection()}
            onToggle={props.onSortToggle}
          />
        </th>
        <th class="px-3 py-2.5 text-right" aria-sort={toAriaSort(etaSortDirection())}>
          <SortHeaderButton
            field="eta"
            label={t(keys.dashboard.table.col.eta)}
            direction={etaSortDirection()}
            onToggle={props.onSortToggle}
            align="right"
          />
        </th>
        <th class="px-3 py-2.5 text-center">{t(keys.dashboard.table.col.sync)}</th>
        <th class="px-3 py-2.5">{t(keys.dashboard.table.col.dominantAlert)}</th>
        <th class="px-3 py-2.5 text-center">{t(keys.dashboard.table.col.activeAlerts)}</th>
      </tr>
    </thead>
  )

  return (
    <div class="overflow-x-auto">
      <table class="w-full">
        {tableHeader}
        <tbody>
          <Show when={exceptionsGroup().length > 0}>
            <GroupHeaderRow
              rowClass="bg-red-50/50"
              labelClass="text-red-500"
              label={t(keys.dashboard.table.groupHeader.exceptions)}
            />
            <For each={exceptionsGroup()}>
              {(process, i) => (
                <DashboardProcessRow
                  process={process}
                  index={i()}
                  onProcessSync={props.onProcessSync}
                />
              )}
            </For>
          </Show>
          <Show when={normalGroup().length > 0}>
            <GroupHeaderRow
              rowClass="bg-slate-50/50"
              labelClass="text-slate-300"
              label={t(keys.dashboard.table.groupHeader.normal)}
            />
            <For each={normalGroup()}>
              {(process, i) => (
                <DashboardProcessRow
                  process={process}
                  index={i()}
                  onProcessSync={props.onProcessSync}
                />
              )}
            </For>
          </Show>
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
        <div class="px-4 py-8 text-center text-body text-slate-400">
          {t(keys.dashboard.loading)}
        </div>
      )
    }

    if (props.hasError) {
      return (
        <div class="px-4 py-8 text-center text-body text-red-500">
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

      // Phase 14: If we have processes but none with exceptions
      if (props.processes.length > 0) {
        return (
          <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <svg
                class="h-6 w-6 text-emerald-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 class="mb-1 text-sm font-semibold text-slate-700">
              {t(keys.dashboard.empty.noExceptions.title)}
            </h3>
            <p class="text-caption text-slate-400">
              {t(keys.dashboard.empty.noExceptions.description)}
            </p>
          </div>
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
          <div class="text-body font-semibold text-slate-700">
            {t(keys.dashboard.table.filters.title)}
          </div>
          <div class="flex gap-2">
            <button
              class={`px-3 py-1.5 text-body rounded-full ${selectedSeverity() === 'all' ? 'bg-slate-100' : 'bg-white'}`}
              type="button"
              onClick={() => setSelectedSeverity('all')}
              aria-pressed={selectedSeverity() === 'all'}
            >
              {t(keys.dashboard.table.filters.all)}
            </button>
            <button
              class={`px-3 py-1.5 text-body rounded-full ${selectedSeverity() === 'danger' ? 'bg-red-100' : 'bg-white'}`}
              type="button"
              onClick={() => setSelectedSeverity('danger')}
              aria-pressed={selectedSeverity() === 'danger'}
            >
              {t(keys.dashboard.table.filters.danger)}
            </button>
            <button
              class={`px-3 py-1.5 text-body rounded-full ${selectedSeverity() === 'warning' ? 'bg-yellow-100' : 'bg-white'}`}
              type="button"
              onClick={() => setSelectedSeverity('warning')}
              aria-pressed={selectedSeverity() === 'warning'}
            >
              {t(keys.dashboard.table.filters.warning)}
            </button>
          </div>
          <div class="ml-auto text-body text-slate-500">
            {filteredBySeverity().length} / {props.processes.length}
          </div>
        </div>

        <DashboardProcessRows
          processes={filteredBySeverity()}
          sortSelection={props.sortSelection}
          onSortToggle={props.onSortToggle}
          onProcessSync={props.onProcessSync}
        />
      </div>
    )
  }

  return (
    <section class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <header class="border-b border-slate-200 bg-slate-50/60 px-4 py-3">
        <h2 class="text-sm font-bold text-slate-800">{t(keys.dashboard.table.title)}</h2>
      </header>
      {content()}
    </section>
  )
}
