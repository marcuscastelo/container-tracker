import { A } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
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

type Props = {
  readonly processes: readonly ProcessSummaryVM[]
  readonly loading: boolean
  readonly hasError: boolean
  readonly onCreateProcess: () => void
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

function SortDirectionIcon(props: {
  readonly direction: DashboardSortDirection | null
}): JSX.Element {
  const arrow = () => {
    if (props.direction === null) return ''
    return props.direction === 'asc' ? '↑' : '↓'
  }

  return (
    <span
      class={`inline-flex h-4 w-4 items-center justify-center text-[11px] leading-none ${
        props.direction ? 'text-slate-600' : 'text-transparent'
      }`}
      aria-hidden="true"
    >
      {arrow()}
    </span>
  )
}

function SortHeaderButton(props: SortHeaderProps): JSX.Element {
  const justifyClass = () => (props.align === 'right' ? 'justify-end' : 'justify-start')

  return (
    <button
      type="button"
      class={`inline-flex w-full items-center ${justifyClass()} gap-1 transition-colors hover:text-slate-600 focus-visible:text-slate-700 focus-visible:outline-none`}
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

function displayRoute(process: ProcessSummaryVM): { origin: string; destination: string } {
  return {
    origin: process.origin?.display_name || '—',
    destination: process.destination?.display_name || '—',
  }
}

function displayImporterName(process: ProcessSummaryVM): string {
  return process.importerName ?? '—'
}

function displayEta(eta: string | null): string {
  if (!eta) return '—'
  return formatDateForLocale(eta)
}

function displayCreatedAt(createdAt: string | null): string {
  if (!createdAt) return '—'
  return formatDateForLocale(createdAt)
}

function DashboardProcessRow(props: RowProps): JSX.Element {
  const { t, keys } = useTranslation()
  const route = () => displayRoute(props.process)

  return (
    <tr class="group border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/80">
      <td class="px-4 py-2.5">
        <A
          href={`/shipments/${props.process.id}`}
          class="text-[13px] font-semibold text-slate-900 hover:text-blue-600 hover:underline"
        >
          {displayProcessRef(props.process)}
        </A>
      </td>
      <td class="px-4 py-2.5">
        <span class="text-[13px] text-slate-600">{props.process.carrier ?? '—'}</span>
      </td>
      <td class="hidden px-4 py-2.5 xl:table-cell">
        <span class="text-[13px] text-slate-500">{displayImporterName(props.process)}</span>
      </td>
      <td class="hidden px-4 py-2.5 lg:table-cell">
        <span class="text-[13px] tabular-nums text-slate-500">
          {displayCreatedAt(props.process.lastEventAt)}
        </span>
      </td>
      <td class="hidden px-4 py-2.5 md:table-cell">
        <div class="flex items-center gap-1.5 text-[13px] text-slate-600">
          <span class="truncate max-w-[120px]">{route().origin}</span>
          <ArrowIcon />
          <span class="truncate max-w-[120px]">{route().destination}</span>
        </div>
      </td>
      <td class="px-4 py-2.5 text-center">
        <span class="inline-flex h-5 min-w-5 items-center justify-center rounded bg-slate-100 px-1.5 text-[11px] font-bold tabular-nums text-slate-700">
          {props.process.containerCount}
        </span>
      </td>
      <td class="px-4 py-2.5">
        <StatusBadge
          variant={props.process.status}
          label={t(trackingStatusToLabelKey(keys, props.process.statusCode))}
        />
      </td>
      <td class="px-4 py-2.5 text-right">
        <Show when={props.process.eta} fallback={<span class="text-[13px] text-slate-300">—</span>}>
          <span class="text-[13px] tabular-nums text-slate-600">
            {displayEta(props.process.eta)}
          </span>
        </Show>
      </td>
    </tr>
  )
}

function DashboardProcessRows(props: TableRowsProps): JSX.Element {
  const { t, keys } = useTranslation()

  const processSortDirection = () =>
    getActiveDashboardSortDirection(props.sortSelection, 'processNumber')
  const providerSortDirection = () =>
    getActiveDashboardSortDirection(props.sortSelection, 'provider')
  const importerSortDirection = () =>
    getActiveDashboardSortDirection(props.sortSelection, 'importerName')
  const createdAtSortDirection = () =>
    getActiveDashboardSortDirection(props.sortSelection, 'createdAt')
  const statusSortDirection = () => getActiveDashboardSortDirection(props.sortSelection, 'status')
  const etaSortDirection = () => getActiveDashboardSortDirection(props.sortSelection, 'eta')

  return (
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <th class="px-4 py-2" aria-sort={toAriaSort(processSortDirection())}>
              <SortHeaderButton
                field="processNumber"
                label={t(keys.dashboard.table.col.process)}
                direction={processSortDirection()}
                onToggle={props.onSortToggle}
              />
            </th>
            <th class="px-4 py-2" aria-sort={toAriaSort(providerSortDirection())}>
              <SortHeaderButton
                field="provider"
                label={t(keys.dashboard.table.col.carrier)}
                direction={providerSortDirection()}
                onToggle={props.onSortToggle}
              />
            </th>
            <th
              class="hidden px-4 py-2 xl:table-cell"
              aria-sort={toAriaSort(importerSortDirection())}
            >
              <SortHeaderButton
                field="importerName"
                label={t(keys.dashboard.table.col.importerName)}
                direction={importerSortDirection()}
                onToggle={props.onSortToggle}
              />
            </th>
            <th
              class="hidden px-4 py-2 lg:table-cell"
              aria-sort={toAriaSort(createdAtSortDirection())}
            >
              <SortHeaderButton
                field="createdAt"
                label={t(keys.dashboard.table.col.createdAt)}
                direction={createdAtSortDirection()}
                onToggle={props.onSortToggle}
              />
            </th>
            <th class="hidden px-4 py-2 md:table-cell">{t(keys.dashboard.table.col.route)}</th>
            <th class="px-4 py-2 text-center">{t(keys.dashboard.table.col.containers)}</th>
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

  const content = () => {
    if (props.loading) {
      return (
        <div class="px-4 py-8 text-center text-[13px] text-slate-400">
          {t(keys.dashboard.loading)}
        </div>
      )
    }

    if (props.hasError) {
      return (
        <div class="px-4 py-8 text-center text-[13px] text-red-500">
          {t(keys.dashboard.error.loadProcesses)}
        </div>
      )
    }

    if (props.processes.length === 0) {
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
      <DashboardProcessRows
        processes={props.processes}
        sortSelection={props.sortSelection}
        onSortToggle={props.onSortToggle}
      />
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
