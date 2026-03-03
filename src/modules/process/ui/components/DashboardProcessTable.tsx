import { A } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type {
  DashboardProcessExceptionSeverity,
  DashboardProcessExceptionVM,
} from '~/modules/process/ui/viewmodels/dashboard-process-exception.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { EmptyState } from '~/shared/ui/EmptyState'
import { StatusBadge } from '~/shared/ui/StatusBadge'
import { formatDateForLocale } from '~/shared/utils/formatDate'

type Props = {
  readonly processes: readonly DashboardProcessExceptionVM[]
  readonly loading: boolean
  readonly hasError: boolean
  readonly onCreateProcess: () => void
}

type RowProps = {
  readonly process: DashboardProcessExceptionVM
}

type TableRowsProps = {
  readonly processes: readonly DashboardProcessExceptionVM[]
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

function displayProcessRef(process: DashboardProcessExceptionVM): string {
  if (process.reference) return process.reference
  return `<${process.processId.slice(0, 8)}>`
}

function displayRoute(process: DashboardProcessExceptionVM): {
  origin: string
  destination: string
} {
  return {
    origin: process.origin ?? '—',
    destination: process.destination ?? '—',
  }
}

function displayEta(eta: string | null): string {
  if (!eta) return '—'
  return formatDateForLocale(eta)
}

function toSeverityBadgeClasses(severity: DashboardProcessExceptionSeverity): string {
  if (severity === 'danger') {
    return 'border-red-200 bg-red-50 text-red-700'
  }
  if (severity === 'warning') {
    return 'border-yellow-200 bg-yellow-50 text-yellow-700'
  }
  if (severity === 'info') {
    return 'border-blue-200 bg-blue-50 text-blue-700'
  }
  if (severity === 'success') {
    return 'border-green-200 bg-green-50 text-green-700'
  }
  return 'border-slate-200 bg-slate-50 text-slate-500'
}

function DashboardProcessRow(props: RowProps): JSX.Element {
  const { t, keys } = useTranslation()
  const route = () => displayRoute(props.process)

  const severityLabel = () => {
    if (props.process.dominantSeverity === 'danger') {
      return t(keys.dashboard.alertIndicators.severity.danger)
    }
    if (props.process.dominantSeverity === 'warning') {
      return t(keys.dashboard.alertIndicators.severity.warning)
    }
    if (props.process.dominantSeverity === 'info') {
      return t(keys.dashboard.alertIndicators.severity.info)
    }
    if (props.process.dominantSeverity === 'success') {
      return t(keys.dashboard.alertIndicators.severity.success)
    }
    return t(keys.dashboard.table.severity.none)
  }

  return (
    <tr class="group border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/80">
      <td class="px-4 py-2.5">
        <A
          href={`/shipments/${props.process.processId}`}
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
          label={t(trackingStatusToLabelKey(keys, props.process.statusCode))}
        />
      </td>
      <td class="px-4 py-2.5 text-right">
        <Show
          when={props.process.etaCurrent}
          fallback={<span class="text-[13px] text-slate-300">—</span>}
        >
          <span class="text-[13px] tabular-nums text-slate-600">
            {displayEta(props.process.etaCurrent)}
          </span>
        </Show>
      </td>
      <td class="px-4 py-2.5">
        <span
          class={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${toSeverityBadgeClasses(props.process.dominantSeverity)}`}
        >
          {severityLabel()}
        </span>
      </td>
      <td class="px-4 py-2.5 text-center">
        <span class="inline-flex h-5 min-w-5 items-center justify-center rounded bg-slate-100 px-1.5 text-[11px] font-bold tabular-nums text-slate-700">
          {props.process.activeAlertCount}
        </span>
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
            <th class="px-4 py-2">{t(keys.dashboard.table.col.route)}</th>
            <th class="px-4 py-2">{t(keys.dashboard.table.col.status)}</th>
            <th class="px-4 py-2 text-right">{t(keys.dashboard.table.col.eta)}</th>
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
