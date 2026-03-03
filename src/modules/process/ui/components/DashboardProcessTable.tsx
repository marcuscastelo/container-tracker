import { A } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
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
}

type RowProps = {
  readonly process: ProcessSummaryVM
}

type TableRowsProps = {
  readonly processes: readonly ProcessSummaryVM[]
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

function DashboardProcessRow(props: RowProps): JSX.Element {
  const { t, keys } = useTranslation()
  const route = () => displayRoute(props.process)

  return (
    <tr class="group cursor-pointer border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/80">
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

  return (
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <th class="px-4 py-2">{t(keys.dashboard.table.col.process)}</th>
            <th class="px-4 py-2">{t(keys.dashboard.table.col.carrier)}</th>
            <th class="hidden px-4 py-2 xl:table-cell">
              {t(keys.dashboard.table.col.importerName)}
            </th>
            <th class="hidden px-4 py-2 md:table-cell">{t(keys.dashboard.table.col.route)}</th>
            <th class="px-4 py-2 text-center">{t(keys.dashboard.table.col.containers)}</th>
            <th class="px-4 py-2">{t(keys.dashboard.table.col.status)}</th>
            <th class="px-4 py-2 text-right">{t(keys.dashboard.table.col.eta)}</th>
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

    return <DashboardProcessRows processes={props.processes} />
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
