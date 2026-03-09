import { A } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { ProcessSyncButton } from '~/modules/process/ui/components/ProcessSyncButton'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import {
  hasDashboardRowSelectedText,
  isInteractiveDashboardRowTarget,
  shouldHandleDashboardRowClick,
  shouldHandleDashboardRowKeydown,
} from '~/modules/process/ui/utils/dashboard-row-navigation'
import { getActiveDashboardSortDirection } from '~/modules/process/ui/viewmodels/dashboard-sort.service'
import type {
  DashboardSortDirection,
  DashboardSortField,
  DashboardSortSelection,
} from '~/modules/process/ui/viewmodels/dashboard-sort.vm'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { EmptyState } from '~/shared/ui/EmptyState'
import { buildProcessHref } from '~/shared/ui/navigation/app-navigation'
import { StatusBadge } from '~/shared/ui/StatusBadge'
import { formatDateForLocale } from '~/shared/utils/formatDate'

type DashboardProcessSeverity = 'danger' | 'warning' | 'info' | 'success' | 'none'

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
  readonly onOpenProcess: (processId: string) => void
}

type RowProps = {
  readonly process: ProcessSummaryVM
  readonly index: number
  readonly onProcessSync: (processId: string) => Promise<void>
  readonly onOpenProcess: (processId: string) => void
}

type TableRowsProps = {
  readonly processes: readonly ProcessSummaryVM[]
  readonly sortSelection: DashboardSortSelection
  readonly onSortToggle: (field: DashboardSortField) => void
  readonly onProcessSync: (processId: string) => Promise<void>
  readonly onOpenProcess: (processId: string) => void
}

type SortHeaderProps = {
  readonly field: DashboardSortField
  readonly label: string
  readonly direction: DashboardSortDirection | null
  readonly onToggle: (field: DashboardSortField) => void
  readonly align?: 'left' | 'center' | 'right'
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

function SortDirectionIcon(props: {
  readonly direction: DashboardSortDirection | null
}): JSX.Element {
  const arrow = () => (props.direction === 'asc' ? '↑' : '↓')

  return (
    <Show when={props.direction !== null}>
      <span
        class="inline-flex h-4 w-4 items-center justify-center text-xs-ui leading-none text-slate-600"
        aria-hidden="true"
      >
        {arrow()}
      </span>
    </Show>
  )
}

function SortHeaderButton(props: SortHeaderProps): JSX.Element {
  const isActive = () => props.direction !== null
  const justifyClass = () => {
    if (props.align === 'right') return 'justify-end'
    if (props.align === 'center') return 'justify-center'
    return 'justify-start'
  }

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

/** Shared grid definition — single source of truth for header + rows */
const GRID_COLS = 'grid grid-cols-[130px_1fr_150px_110px_70px_80px] divide-x divide-slate-200/50'

/** Severity weight for default priority ordering (lower = higher priority). */
const SEVERITY_ORDER: Record<DashboardProcessSeverity, number> = {
  danger: 0,
  warning: 1,
  info: 2,
  success: 3,
  none: 4,
}

function toUnifiedAlertIcon(severity: DashboardProcessSeverity): string {
  if (severity === 'danger') return '⛔'
  if (severity === 'warning') return '⚠'
  if (severity === 'info') return 'ℹ'
  return '✓'
}

function formatDashboardAlertAge(params: {
  readonly triggeredAtIso: string | null
  readonly t: (key: string, opts?: Record<string, unknown>) => string
  readonly keys: ReturnType<typeof useTranslation>['keys']
}): { label: string; agingClass: string } | null {
  if (!params.triggeredAtIso) return null
  const date = new Date(params.triggeredAtIso)
  if (Number.isNaN(date.getTime())) return null

  const diffMs = Date.now() - date.getTime()
  const hours = Math.floor(diffMs / 3_600_000)
  const days = Math.floor(hours / 24)

  let label: string
  if (hours < 1) label = params.t(params.keys.dashboard.table.age.now)
  else if (hours < 24) label = params.t(params.keys.dashboard.table.age.hours, { count: hours })
  else label = params.t(params.keys.dashboard.table.age.days, { count: days })

  // Aging color: 0-24h neutral, 1-3d warning, 4+d danger.
  let agingClass: string
  if (days >= 4) agingClass = 'text-red-500'
  else if (days >= 1) agingClass = 'text-amber-500'
  else agingClass = 'text-slate-400'

  return { label, agingClass }
}

function DashboardProcessRow(props: RowProps): JSX.Element {
  const { t, keys } = useTranslation()
  const route = () => displayRoute(props.process)
  const processHref = () => buildProcessHref(props.process.id)

  const dominantSeverity = () => toDominantSeverity(props.process)
  const dominantAlertLabel = () => toDominantAlertLabel(props.process, t, keys)

  const severityLabel = () => {
    if (dominantSeverity() === 'danger') return t(keys.dashboard.alertIndicators.severity.danger)
    if (dominantSeverity() === 'warning') return t(keys.dashboard.alertIndicators.severity.warning)
    if (dominantSeverity() === 'info') return t(keys.dashboard.alertIndicators.severity.info)
    if (dominantSeverity() === 'success') return t(keys.dashboard.alertIndicators.severity.success)
    return t(keys.dashboard.table.dominantAlertLabel.noAlerts)
  }

  const alertAge = () =>
    formatDashboardAlertAge({
      triggeredAtIso: props.process.dominantAlertCreatedAt,
      t,
      keys,
    })

  const alertTooltip = (): string | undefined => {
    if (dominantSeverity() === 'none') return undefined
    const parts: string[] = [dominantAlertLabel()]
    const age = alertAge()
    if (age) parts.push(`· ${age.label}`)
    const extra = props.process.alertsCount - 1
    if (extra > 0) {
      parts.push(t(keys.dashboard.table.alertTooltip.additionalAlerts, { count: extra }))
    }
    return parts.join('\n')
  }

  const zebraClass = () => (props.index % 2 === 1 ? 'bg-gray-50/60' : 'bg-white/60')
  const openProcess = () => {
    props.onOpenProcess(props.process.id)
  }

  const handleRowClick = (event: MouseEvent) => {
    const shouldNavigate = shouldHandleDashboardRowClick({
      defaultPrevented: event.defaultPrevented,
      button: event.button,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      interactiveTarget: isInteractiveDashboardRowTarget(event.target),
      hasSelectedText: hasDashboardRowSelectedText(),
    })
    if (!shouldNavigate) return

    event.preventDefault()
    openProcess()
  }

  const handleProcessLinkClick = (event: MouseEvent) => {
    if (event.defaultPrevented) return
    if (event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    openProcess()
  }

  const handleRowKeydown = (event: KeyboardEvent) => {
    const shouldNavigate = shouldHandleDashboardRowKeydown({
      defaultPrevented: event.defaultPrevented,
      key: event.key,
      interactiveTarget: isInteractiveDashboardRowTarget(event.target),
    })
    if (!shouldNavigate) return

    event.preventDefault()
    openProcess()
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: Row-level delegated navigation must coexist with internal interactive controls, which prevents using a single semantic <button>/<a> wrapper.
    <div
      role="button"
      tabIndex={0}
      class={`${GRID_COLS} group items-center border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 cursor-pointer ${zebraClass()} ${getSeverityBorderClass(dominantSeverity())}`}
      onClick={handleRowClick}
      onKeyDown={handleRowKeydown}
    >
      {/* Process — visual anchor */}
      <div class="overflow-hidden px-3 py-2">
        <A
          href={processHref()}
          class="text-md-ui font-semibold text-slate-900 hover:text-blue-700 hover:underline whitespace-nowrap truncate block"
          onClick={handleProcessLinkClick}
        >
          {displayProcessRef(props.process)}
        </A>
      </div>
      {/* Route — secondary */}
      <div class="overflow-hidden px-3 py-2">
        <A href={processHref()} class="block" onClick={handleProcessLinkClick}>
          <div class="flex items-center gap-1 text-xs-ui text-slate-500 leading-tight">
            <span class="truncate">{route().origin}</span>
            <ArrowIcon />
            <span class="truncate font-medium text-slate-600">{route().destination}</span>
            <Show when={props.process.redestinationNumber}>
              <span class="text-micro text-slate-400">({props.process.redestinationNumber})</span>
            </Show>
          </div>
        </A>
      </div>
      {/* Status */}
      <div class="px-3 py-2 text-center">
        <A href={processHref()} class="block" onClick={handleProcessLinkClick}>
          <StatusBadge
            variant={props.process.status}
            label={t(trackingStatusToLabelKey(keys, props.process.statusCode))}
          />
        </A>
      </div>
      {/* ETA — emphasis by exception */}
      <div class="px-3 py-2 text-center">
        <A href={processHref()} class="block" onClick={handleProcessLinkClick}>
          <Show
            when={props.process.eta}
            fallback={<span class="text-xs-ui text-slate-300">—</span>}
          >
            <span
              class={`text-md-ui font-bold tabular-nums ${props.process.status === 'delayed' ? 'text-red-600' : 'text-slate-900'}`}
            >
              {displayEta(props.process.eta)}
            </span>
          </Show>
        </A>
      </div>
      {/* Sync */}
      <div class="px-3 py-2 text-center">
        <ProcessSyncButton
          processId={props.process.id}
          status={props.process.syncStatus}
          lastSyncAt={props.process.lastSyncAt}
          onSync={props.onProcessSync}
        />
      </div>
      {/* Alerts — compact icon + count with tooltip */}
      <div class="px-3 py-2 text-center">
        <A href={processHref()} class="block" onClick={handleProcessLinkClick}>
          <Show
            when={dominantSeverity() !== 'none'}
            fallback={
              <span
                class="text-xs-ui text-emerald-400"
                role="img"
                aria-label={dominantAlertLabel()}
              >
                ✓
              </span>
            }
          >
            <span
              class={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-micro font-bold leading-none cursor-default ${toSeverityBadgeClasses(dominantSeverity())}`}
              title={alertTooltip()}
            >
              <span aria-hidden="true">{toUnifiedAlertIcon(dominantSeverity())}</span>
              {props.process.alertsCount}
              <span class="sr-only">{`${severityLabel()}: ${dominantAlertLabel()}`}</span>
            </span>
          </Show>
        </A>
      </div>
    </div>
  )
}

function DashboardProcessRows(props: TableRowsProps): JSX.Element {
  const { t, keys } = useTranslation()

  const processSortDirection = () =>
    getActiveDashboardSortDirection(props.sortSelection, 'processNumber')
  const statusSortDirection = () => getActiveDashboardSortDirection(props.sortSelection, 'status')
  const etaSortDirection = () => getActiveDashboardSortDirection(props.sortSelection, 'eta')

  /** Default priority ordering: severity desc → alert count desc → preserve API order. */
  const prioritySorted = (): readonly ProcessSummaryVM[] => {
    if (props.sortSelection !== null) return props.processes
    return [...props.processes].sort((a, b) => {
      const sevDiff = SEVERITY_ORDER[toDominantSeverity(a)] - SEVERITY_ORDER[toDominantSeverity(b)]
      if (sevDiff !== 0) return sevDiff
      return b.alertsCount - a.alertsCount
    })
  }

  const tableHeader = (
    <div
      class={`${GRID_COLS} bg-white/80 border-b border-slate-200 text-left text-xs-ui font-semibold uppercase tracking-wide text-slate-500`}
    >
      <div class="px-3 py-2.5">
        <SortHeaderButton
          field="processNumber"
          label={t(keys.dashboard.table.col.process)}
          direction={processSortDirection()}
          onToggle={props.onSortToggle}
        />
      </div>
      <div class="px-3 py-2.5">{t(keys.dashboard.table.col.route)}</div>
      <div class="px-3 py-2.5 text-center">
        <SortHeaderButton
          field="status"
          label={t(keys.dashboard.table.col.status)}
          direction={statusSortDirection()}
          onToggle={props.onSortToggle}
          align="center"
        />
      </div>
      <div class="px-3 py-2.5 text-center">
        <SortHeaderButton
          field="eta"
          label={t(keys.dashboard.table.col.eta)}
          direction={etaSortDirection()}
          onToggle={props.onSortToggle}
          align="center"
        />
      </div>
      <div class="px-3 py-2.5 text-center">{t(keys.dashboard.table.col.sync)}</div>
      <div class="px-3 py-2.5 text-center">{t(keys.dashboard.table.col.alerts)}</div>
    </div>
  )

  return (
    <div class="overflow-x-auto">
      {tableHeader}
      <div>
        <For each={prioritySorted()}>
          {(process, i) => (
            <DashboardProcessRow
              process={process}
              index={i()}
              onProcessSync={props.onProcessSync}
              onOpenProcess={props.onOpenProcess}
            />
          )}
        </For>
      </div>
    </div>
  )
}

export function DashboardProcessTable(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  const content = () => {
    if (props.loading) {
      return (
        <div class="px-4 py-8 text-center text-md-ui text-slate-400">
          {t(keys.dashboard.loading)}
        </div>
      )
    }

    if (props.hasError) {
      return (
        <div class="px-4 py-8 text-center text-md-ui text-red-500">
          {t(keys.dashboard.error.loadProcesses)}
        </div>
      )
    }

    if (props.processes.length === 0) {
      if (props.hasActiveFilters) {
        return (
          <EmptyState
            title={t(keys.dashboard.empty.filtered.title)}
            description={t(keys.dashboard.empty.filtered.description)}
            actionLabel={t(keys.dashboard.empty.filtered.action)}
            onAction={props.onClearFilters}
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
      <DashboardProcessRows
        processes={props.processes}
        sortSelection={props.sortSelection}
        onSortToggle={props.onSortToggle}
        onProcessSync={props.onProcessSync}
        onOpenProcess={props.onOpenProcess}
      />
    )
  }

  return (
    <section class="overflow-hidden rounded-lg border border-slate-200 bg-white/80 shadow-sm">
      <header class="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
        <h2 class="text-sm-ui font-bold text-slate-800">{t(keys.dashboard.table.title)}</h2>
      </header>
      {content()}
    </section>
  )
}
