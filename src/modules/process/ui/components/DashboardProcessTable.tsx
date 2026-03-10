import { A } from '@solidjs/router'
import { Check, ChevronDown, ChevronUp, CircleAlert, OctagonX, TriangleAlert } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import {
  buildGridTemplate,
  type DashboardColumnDef,
  type DashboardColumnId,
  getColumnDef,
  moveColumn,
  readColumnOrderFromLocalStorage,
  writeColumnOrderToLocalStorage,
} from '~/modules/process/ui/components/dashboard-columns'
import { toDashboardStatusCellDisplay } from '~/modules/process/ui/components/dashboard-status-cell.presenter'
import {
  SyncCell as SyncCellComponent,
  type SyncCellState,
} from '~/modules/process/ui/components/SyncCell'
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  readonly onProcessIntent: (processId: string) => void
}

type RowProps = {
  readonly process: ProcessSummaryVM
  readonly index: number
  readonly columnOrder: readonly DashboardColumnId[]
  readonly gridStyle: string
  readonly onProcessSync: (processId: string) => Promise<void>
  readonly onOpenProcess: (processId: string) => void
  readonly onProcessIntent: (processId: string) => void
}

type TableRowsProps = {
  readonly processes: readonly ProcessSummaryVM[]
  readonly sortSelection: DashboardSortSelection
  readonly onSortToggle: (field: DashboardSortField) => void
  readonly onProcessSync: (processId: string) => Promise<void>
  readonly onOpenProcess: (processId: string) => void
  readonly onProcessIntent: (processId: string) => void
  readonly columnOrder: readonly DashboardColumnId[]
  readonly onColumnReorder: (columnId: DashboardColumnId, targetIndex: number) => void
}

type SortHeaderProps = {
  readonly field: DashboardSortField
  readonly label: string
  readonly direction: DashboardSortDirection | null
  readonly onToggle: (field: DashboardSortField) => void
  readonly align?: 'left' | 'center' | 'right'
}

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

/** Severity weight for default priority ordering (lower = higher priority). */
const SEVERITY_ORDER: Record<DashboardProcessSeverity, number> = {
  danger: 0,
  warning: 1,
  info: 2,
  success: 3,
  none: 4,
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
  if (severity === 'danger') return '[box-shadow:inset_4px_0_0_0_#ef4444]'
  if (severity === 'warning') return '[box-shadow:inset_4px_0_0_0_#fbbf24]'
  if (severity === 'info') return '[box-shadow:inset_4px_0_0_0_#93c5fd]'
  return ''
}

function toUnifiedAlertIcon(severity: DashboardProcessSeverity): JSX.Element {
  if (severity === 'danger') return <OctagonX class="w-3 h-3" />
  if (severity === 'warning') return <TriangleAlert class="w-3 h-3" />
  if (severity === 'info') return <CircleAlert class="w-3 h-3" />
  return <Check class="w-3 h-3" />
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function displayProcessRef(process: ProcessSummaryVM): string {
  if (process.reference) return process.reference
  return `<${process.id.slice(0, 8)}>`
}

function displayRoute(process: ProcessSummaryVM): { origin: string; destination: string } {
  return {
    origin: process.origin?.display_name ?? '—',
    destination: process.destination?.display_name ?? '—',
  }
}

function displayEta(eta: string | null): string {
  if (!eta) return '—'
  return formatDateForLocale(eta)
}

function displayTruncatedText(value: string | null): string {
  return value ?? '—'
}

// ---------------------------------------------------------------------------
// Arrow icon (route)
// ---------------------------------------------------------------------------

function ArrowIcon(): JSX.Element {
  return (
    <svg
      class="h-3 w-3 shrink-0 text-slate-300"
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

// ---------------------------------------------------------------------------
// Sort UI
// ---------------------------------------------------------------------------

function SortDirectionIcon(props: {
  readonly direction: DashboardSortDirection | null
}): JSX.Element {
  const Arrow = () =>
    props.direction === 'asc' ? (
      <ChevronUp class="w-3.5 h-3.5" />
    ) : (
      <ChevronDown class="w-3.5 h-3.5" />
    )

  return (
    <Show when={props.direction !== null}>
      <span
        class="inline-flex h-4 w-4 items-center justify-center text-slate-600"
        aria-hidden="true"
      >
        <Arrow />
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

// ---------------------------------------------------------------------------
// Alert age
// ---------------------------------------------------------------------------

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

  let agingClass: string
  if (days >= 4) agingClass = 'text-red-500'
  else if (days >= 1) agingClass = 'text-amber-500'
  else agingClass = 'text-slate-400'

  return { label, agingClass }
}

// ---------------------------------------------------------------------------
// Cell renderers — one per column, each receives the full row context
// ---------------------------------------------------------------------------

type CellContext = {
  readonly process: ProcessSummaryVM
  readonly processHref: string
  readonly handleProcessLinkClick: (event: MouseEvent) => void
  readonly triggerProcessIntent: () => void
  readonly t: ReturnType<typeof useTranslation>['t']
  readonly keys: ReturnType<typeof useTranslation>['keys']
  readonly onProcessSync: (processId: string) => Promise<void>
}

function ProcessRefCell(ctx: CellContext): JSX.Element {
  return (
    <div class="min-w-0 overflow-hidden px-3 py-2">
      <A
        href={ctx.processHref}
        class="row-link block truncate text-md-ui font-semibold text-slate-900 hover:text-sky-700"
        onClick={ctx.handleProcessLinkClick}
        onPointerEnter={ctx.triggerProcessIntent}
        onFocusIn={ctx.triggerProcessIntent}
        onPointerDown={ctx.triggerProcessIntent}
      >
        {displayProcessRef(ctx.process)}
      </A>
    </div>
  )
}

function ImporterCell(ctx: CellContext): JSX.Element {
  return (
    <div class="min-w-0 overflow-hidden px-3 py-2">
      <A
        href={ctx.processHref}
        class="row-link block truncate text-xs-ui text-slate-600"
        onClick={ctx.handleProcessLinkClick}
        onPointerEnter={ctx.triggerProcessIntent}
        onFocusIn={ctx.triggerProcessIntent}
        onPointerDown={ctx.triggerProcessIntent}
      >
        {displayTruncatedText(ctx.process.importerName)}
      </A>
    </div>
  )
}

function ExporterCell(ctx: CellContext): JSX.Element {
  return (
    <div class="min-w-0 overflow-hidden px-3 py-2">
      <A
        href={ctx.processHref}
        class="row-link block truncate text-xs-ui text-slate-600"
        onClick={ctx.handleProcessLinkClick}
        onPointerEnter={ctx.triggerProcessIntent}
        onFocusIn={ctx.triggerProcessIntent}
        onPointerDown={ctx.triggerProcessIntent}
      >
        {displayTruncatedText(ctx.process.exporterName)}
      </A>
    </div>
  )
}

function RouteCell(ctx: CellContext): JSX.Element {
  const route = () => displayRoute(ctx.process)
  return (
    <div class="min-w-0 overflow-hidden px-3 py-2">
      <A
        href={ctx.processHref}
        class="row-link block"
        onClick={ctx.handleProcessLinkClick}
        onPointerEnter={ctx.triggerProcessIntent}
        onFocusIn={ctx.triggerProcessIntent}
        onPointerDown={ctx.triggerProcessIntent}
      >
        <div class="flex min-w-0 items-center gap-1 text-xs-ui text-slate-500 leading-tight">
          <span class="truncate">{route().origin}</span>
          <ArrowIcon />
          <span class="truncate font-medium text-slate-600">{route().destination}</span>
          <Show when={ctx.process.redestinationNumber}>
            <span class="shrink-0 text-micro text-slate-400">
              ({ctx.process.redestinationNumber})
            </span>
          </Show>
        </div>
      </A>
    </div>
  )
}

function StatusCell(ctx: CellContext): JSX.Element {
  // compute display data once per render to avoid recomputing translations and
  // microbadge mapping multiple times during JSX evaluation
  const display = createMemo(() =>
    toDashboardStatusCellDisplay({
      source: {
        status: ctx.process.status,
        statusCode: ctx.process.statusCode,
        statusMicrobadge: ctx.process.statusMicrobadge,
      },
      t: ctx.t,
      keys: ctx.keys,
    }),
  )

  return (
    <div class="min-w-0 overflow-hidden px-3 py-2 flex items-center justify-center">
      <A
        href={ctx.processHref}
        class="row-link inline-flex max-w-full items-center"
        onClick={ctx.handleProcessLinkClick}
        onPointerEnter={ctx.triggerProcessIntent}
        onFocusIn={ctx.triggerProcessIntent}
        onPointerDown={ctx.triggerProcessIntent}
      >
        <div class="inline-flex max-w-full flex-col items-start leading-tight">
          <StatusBadge variant={display().primary.variant} label={display().primary.label} />
          <Show when={display().subtitle}>
            {(subtitle) => (
              <span
                class={`mt-1 max-w-full truncate whitespace-nowrap text-xs-ui font-medium ${subtitle().textClass}`}
              >
                {subtitle().label}
              </span>
            )}
          </Show>
        </div>
      </A>
    </div>
  )
}

function EtaCell(ctx: CellContext): JSX.Element {
  return (
    <div class="min-w-0 overflow-hidden px-3 py-2 text-center">
      <A
        href={ctx.processHref}
        class="row-link block"
        onClick={ctx.handleProcessLinkClick}
        onPointerEnter={ctx.triggerProcessIntent}
        onFocusIn={ctx.triggerProcessIntent}
        onPointerDown={ctx.triggerProcessIntent}
      >
        <Show when={ctx.process.eta} fallback={<span class="text-xs-ui text-slate-300">—</span>}>
          <span
            class={`text-md-ui font-bold tabular-nums ${ctx.process.status === 'delayed' ? 'text-red-600' : 'text-slate-900'}`}
          >
            {displayEta(ctx.process.eta)}
          </span>
        </Show>
      </A>
    </div>
  )
}

function SyncCell(ctx: CellContext): JSX.Element {
  const cellState = (): SyncCellState => {
    const s = ctx.process.syncStatus
    if (s === 'syncing') return 'syncing'
    if (s === 'success') return 'success_recent'
    if (s === 'error') return 'failed'
    return 'idle'
  }
  return (
    <SyncCellComponent
      state={cellState()}
      onSync={() => {
        void ctx.onProcessSync(ctx.process.id)
      }}
    />
  )
}

function AlertsCell(ctx: CellContext): JSX.Element {
  const dominantSeverity = () => toDominantSeverity(ctx.process)
  const dominantAlertLabel = () => toDominantAlertLabel(ctx.process, ctx.t, ctx.keys)

  const severityLabel = () => {
    if (dominantSeverity() === 'danger')
      return ctx.t(ctx.keys.dashboard.alertIndicators.severity.danger)
    if (dominantSeverity() === 'warning')
      return ctx.t(ctx.keys.dashboard.alertIndicators.severity.warning)
    if (dominantSeverity() === 'info')
      return ctx.t(ctx.keys.dashboard.alertIndicators.severity.info)
    if (dominantSeverity() === 'success')
      return ctx.t(ctx.keys.dashboard.alertIndicators.severity.success)
    return ctx.t(ctx.keys.dashboard.table.dominantAlertLabel.noAlerts)
  }

  const alertAge = () =>
    formatDashboardAlertAge({
      triggeredAtIso: ctx.process.dominantAlertCreatedAt,
      t: ctx.t,
      keys: ctx.keys,
    })

  const alertTooltip = (): string | undefined => {
    if (dominantSeverity() === 'none') return undefined
    const parts: string[] = [dominantAlertLabel()]
    const age = alertAge()
    if (age) parts.push(`· ${age.label}`)
    const extra = ctx.process.alertsCount - 1
    if (extra > 0) {
      parts.push(ctx.t(ctx.keys.dashboard.table.alertTooltip.additionalAlerts, { count: extra }))
    }
    return parts.join('\n')
  }

  return (
    <div class="min-w-0 overflow-hidden px-3 py-2 text-center">
      <A
        href={ctx.processHref}
        class="row-link block"
        onClick={ctx.handleProcessLinkClick}
        onPointerEnter={ctx.triggerProcessIntent}
        onFocusIn={ctx.triggerProcessIntent}
        onPointerDown={ctx.triggerProcessIntent}
      >
        <Show
          when={dominantSeverity() !== 'none'}
          fallback={
            <span class="text-xs-ui text-emerald-400" role="img" aria-label={dominantAlertLabel()}>
              <Check class="w-3.5 h-3.5" />
            </span>
          }
        >
          <span
            class={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-micro font-bold leading-none cursor-default ${toSeverityBadgeClasses(dominantSeverity())}`}
            title={alertTooltip()}
          >
            <span aria-hidden="true">{toUnifiedAlertIcon(dominantSeverity())}</span>
            {ctx.process.alertsCount}
            <span class="sr-only">{`${severityLabel()}: ${dominantAlertLabel()}`}</span>
          </span>
        </Show>
      </A>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cell dispatcher
// ---------------------------------------------------------------------------

const CELL_RENDERERS: Record<DashboardColumnId, (ctx: CellContext) => JSX.Element> = {
  processRef: ProcessRefCell,
  importer: ImporterCell,
  exporter: ExporterCell,
  route: RouteCell,
  status: StatusCell,
  eta: EtaCell,
  sync: SyncCell,
  alerts: AlertsCell,
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function DashboardProcessRow(props: RowProps): JSX.Element {
  const { t, keys } = useTranslation()
  const processHref = () => buildProcessHref(props.process.id)
  const dominantSeverity = () => toDominantSeverity(props.process)
  const zebraClass = () => (props.index % 2 === 1 ? 'bg-gray-50/60' : 'bg-white/60')

  const triggerProcessIntent = () => {
    props.onProcessIntent(props.process.id)
  }

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

  const cellContext = (): CellContext => ({
    process: props.process,
    processHref: processHref(),
    handleProcessLinkClick,
    triggerProcessIntent,
    t,
    keys,
    onProcessSync: props.onProcessSync,
  })

  return (
    // biome-ignore lint/a11y/useSemanticElements: Row-level delegated navigation must coexist with internal interactive controls, which prevents using a single semantic <button>/<a> wrapper.
    <div
      role="button"
      tabIndex={0}
      class={`grid items-center border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 cursor-pointer ${zebraClass()} ${getSeverityBorderClass(dominantSeverity())}`}
      style={{ 'grid-template-columns': props.gridStyle }}
      onClick={handleRowClick}
      onKeyDown={handleRowKeydown}
      onPointerEnter={triggerProcessIntent}
      onFocusIn={triggerProcessIntent}
      onPointerDown={triggerProcessIntent}
    >
      <For each={props.columnOrder}>
        {(colId) => {
          const renderer = CELL_RENDERERS[colId]
          return renderer(cellContext())
        }}
      </For>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function DashboardTableHeader(props: {
  readonly columnOrder: readonly DashboardColumnId[]
  readonly gridStyle: string
  readonly sortSelection: DashboardSortSelection
  readonly onSortToggle: (field: DashboardSortField) => void
  readonly onColumnReorder: (columnId: DashboardColumnId, targetIndex: number) => void
}): JSX.Element {
  const { t, keys } = useTranslation()

  const [draggedColumn, setDraggedColumn] = createSignal<DashboardColumnId | null>(null)
  const [dragOverIndex, setDragOverIndex] = createSignal<number | null>(null)

  const columnLabelKeys: Record<string, string> = {
    process: keys.dashboard.table.col.process,
    importerName: keys.dashboard.table.col.importerName,
    exporterName: keys.dashboard.table.col.exporterName,
    route: keys.dashboard.table.col.route,
    status: keys.dashboard.table.col.status,
    eta: keys.dashboard.table.col.eta,
    sync: keys.dashboard.table.col.sync,
    alerts: keys.dashboard.table.col.alerts,
  }

  const resolveLabel = (colDef: DashboardColumnDef): string => {
    const keyPath = columnLabelKeys[colDef.labelKey]
    return keyPath ? t(keyPath) : colDef.labelKey
  }

  const handleDragStart = (colId: DashboardColumnId, colDef: DashboardColumnDef, e: DragEvent) => {
    if (!colDef.reorderable) {
      e.preventDefault()
      return
    }
    setDraggedColumn(colId)
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', colId)
    }
  }

  const handleDragOver = (index: number, e: DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (targetIndex: number, e: DragEvent) => {
    e.preventDefault()
    const columnId = draggedColumn()
    setDraggedColumn(null)
    setDragOverIndex(null)

    if (!columnId) return
    props.onColumnReorder(columnId, targetIndex)
  }

  const handleDragEnd = () => {
    setDraggedColumn(null)
    setDragOverIndex(null)
  }

  return (
    <div
      class="grid border-b border-slate-200 bg-white/80 text-left text-xs-ui font-semibold uppercase tracking-wide text-slate-500"
      style={{ 'grid-template-columns': props.gridStyle }}
    >
      <For each={props.columnOrder}>
        {(colId, i) => {
          const colDef = getColumnDef(colId)
          const isDragTarget = () => dragOverIndex() === i()
          const alignClass = () => {
            if (colDef.align === 'center') return 'text-center'
            if (colDef.align === 'right') return 'text-right'
            return ''
          }

          return (
            // biome-ignore lint/a11y/useSemanticElements: CSS grid layout precludes semantic <th>
            <div
              role="columnheader"
              tabIndex={colDef.reorderable ? 0 : undefined}
              class={`px-3 py-2.5 ${alignClass()} ${colDef.reorderable ? 'cursor-grab' : ''} ${isDragTarget() ? 'bg-sky-50' : ''}`}
              draggable={colDef.reorderable}
              onDragStart={(e: DragEvent) => handleDragStart(colId, colDef, e)}
              onDragOver={(e: DragEvent) => handleDragOver(i(), e)}
              onDragLeave={handleDragLeave}
              onDrop={(e: DragEvent) => handleDrop(i(), e)}
              onDragEnd={handleDragEnd}
            >
              <Show when={colDef.sortField} fallback={<span>{resolveLabel(colDef)}</span>}>
                {(sortField) => (
                  <SortHeaderButton
                    field={sortField()}
                    label={resolveLabel(colDef)}
                    direction={getActiveDashboardSortDirection(props.sortSelection, sortField())}
                    onToggle={props.onSortToggle}
                    align={colDef.align}
                  />
                )}
              </Show>
            </div>
          )
        }}
      </For>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table body (rows + header)
// ---------------------------------------------------------------------------

function DashboardProcessRows(props: TableRowsProps): JSX.Element {
  const gridStyle = createMemo(() => buildGridTemplate(props.columnOrder))

  /** Default priority ordering: severity desc → alert count desc → preserve API order. */
  const prioritySorted = (): readonly ProcessSummaryVM[] => {
    if (props.sortSelection !== null) return props.processes
    return [...props.processes].sort((a, b) => {
      const sevDiff = SEVERITY_ORDER[toDominantSeverity(a)] - SEVERITY_ORDER[toDominantSeverity(b)]
      if (sevDiff !== 0) return sevDiff
      return b.alertsCount - a.alertsCount
    })
  }

  return (
    <div class="overflow-x-hidden">
      <DashboardTableHeader
        columnOrder={props.columnOrder}
        gridStyle={gridStyle()}
        sortSelection={props.sortSelection}
        onSortToggle={props.onSortToggle}
        onColumnReorder={props.onColumnReorder}
      />
      <div>
        <For each={prioritySorted()}>
          {(process, i) => (
            <DashboardProcessRow
              process={process}
              index={i()}
              columnOrder={props.columnOrder}
              gridStyle={gridStyle()}
              onProcessSync={props.onProcessSync}
              onOpenProcess={props.onOpenProcess}
              onProcessIntent={props.onProcessIntent}
            />
          )}
        </For>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function DashboardProcessTable(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const [columnOrder, setColumnOrder] = createSignal<readonly DashboardColumnId[]>(
    readColumnOrderFromLocalStorage(),
  )

  const handleColumnReorder = (columnId: DashboardColumnId, targetIndex: number) => {
    const result = moveColumn(columnOrder(), columnId, targetIndex)
    if (!result) return
    setColumnOrder(result)
    writeColumnOrderToLocalStorage(result)
  }

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
        onProcessIntent={props.onProcessIntent}
        columnOrder={columnOrder()}
        onColumnReorder={handleColumnReorder}
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
