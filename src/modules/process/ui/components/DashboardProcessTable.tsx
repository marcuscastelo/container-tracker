import { A } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { EmptyState } from '~/shared/ui/EmptyState'
import { StatusBadge } from '~/shared/ui/StatusBadge'

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
      class="h-4 w-4 text-slate-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
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

function DashboardProcessRow(props: RowProps): JSX.Element {
  const { t, keys } = useTranslation()
  const route = () => displayRoute(props.process)

  return (
    <tr class="transition-colors hover:bg-slate-50">
      <td class="px-6 py-4">
        <A
          href={`/shipments/${props.process.id}`}
          class="font-medium text-slate-900 hover:text-slate-700 hover:underline"
        >
          {displayProcessRef(props.process)}
        </A>
      </td>
      <td class="px-6 py-4">
        <span class="text-sm text-slate-600">{props.process.carrier ?? '—'}</span>
      </td>
      <td class="px-6 py-4">
        <span class="text-sm text-slate-600">{displayImporterName(props.process)}</span>
      </td>
      <td class="px-6 py-4">
        <div class="flex items-center gap-2 text-sm text-slate-600">
          <span>{route().origin}</span>
          <ArrowIcon />
          <span>{route().destination}</span>
        </div>
      </td>
      <td class="px-6 py-4 text-center">
        <span class="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-medium text-slate-700">
          {props.process.containerCount}
        </span>
      </td>
      <td class="px-6 py-4">
        <StatusBadge
          variant={props.process.status}
          label={t(trackingStatusToLabelKey(keys, props.process.statusCode))}
        />
      </td>
      <td class="px-6 py-4 text-sm text-slate-600">
        <Show when={props.process.eta} fallback={<span class="text-slate-400">—</span>}>
          {props.process.eta}
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
          <tr class="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
            <th class="px-6 py-3">{t(keys.dashboard.table.col.process)}</th>
            <th class="px-6 py-3">{t(keys.dashboard.table.col.carrier)}</th>
            <th class="px-6 py-3">{t(keys.dashboard.table.col.importerName)}</th>
            <th class="px-6 py-3">{t(keys.dashboard.table.col.route)}</th>
            <th class="px-6 py-3 text-center">{t(keys.dashboard.table.col.containers)}</th>
            <th class="px-6 py-3">{t(keys.dashboard.table.col.status)}</th>
            <th class="px-6 py-3">{t(keys.dashboard.table.col.eta)}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
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
      return <div class="px-6 py-12 text-center text-slate-500">{t(keys.dashboard.loading)}</div>
    }

    if (props.hasError) {
      return (
        <div class="px-6 py-12 text-center text-red-500">
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
    <section class="rounded-lg border border-slate-200 bg-white">
      <header class="border-b border-slate-200 px-6 py-4">
        <h2 class="text-lg font-semibold text-slate-900">{t(keys.dashboard.table.title)}</h2>
      </header>
      {content()}
    </section>
  )
}
