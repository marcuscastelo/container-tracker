import { A } from '@solidjs/router'
import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  OctagonX,
  RefreshCw,
  TriangleAlert,
} from 'lucide-solid'
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
import { toDashboardEtaCellLabel } from '~/modules/process/ui/components/dashboard-process-table.presenter'
import { createDashboardStatusCellDisplayMemo } from '~/modules/process/ui/components/dashboard-status-cell.display'
import {
  SyncCell as SyncCellComponent,
  type SyncCellState,
} from '~/modules/process/ui/components/SyncCell'
import {
  type TrackingValidationCopyLabels,
  toTrackingValidationTooltipText,
} from '~/modules/process/ui/components/tracking-review-copy.presenter'
import {
  toTrackingValidationBadgeClasses,
  toTrackingValidationDisplayState,
} from '~/modules/process/ui/components/tracking-review-display.presenter'
import { toDashboardProcessRowClass } from '~/modules/process/ui/utils/dashboard-process-row-style'
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
import { toCarrierDisplayLabel } from '~/shared/utils/carrierDisplay'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DashboardProcessSeverity = 'danger' | 'warning' | 'info' | 'success' | 'none'

type Props = {
  readonly processes: readonly ProcessSummaryVM[]
  readonly highlightedProcessId: string | null
  readonly initialLoading: boolean
  readonly refreshing: boolean
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
  readonly isHighlighted: boolean
  readonly columnOrder: readonly DashboardColumnId[]
  readonly gridStyle: string
  readonly onProcessSync: (processId: string) => Promise<void>
  readonly onOpenProcess: (processId: string) => void
  readonly onProcessIntent: (processId: string) => void
}

type TableRowsProps = {
  readonly processes: readonly ProcessSummaryVM[]
  readonly highlightedProcessId: string | null
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

const DASHBOARD_TABLE_SKELETON_ROW_KEYS = [
  'dashboard-row-skeleton-1',
  'dashboard-row-skeleton-2',
  'dashboard-row-skeleton-3',
  'dashboard-row-skeleton-4',
  'dashboard-row-skeleton-5',
] as const

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
  const attentionSeverity = process.attentionSeverity
  if (attentionSeverity === 'danger') return 'danger'
  if (attentionSeverity === 'warning') return 'warning'
  if (attentionSeverity === 'info') return 'info'
  return 'none'
}

function toAlertBadgeSeverity(process: ProcessSummaryVM): DashboardProcessSeverity {
  const highestSeverity = process.dominantIncident?.severity ?? null
  if (highestSeverity === 'danger') return 'danger'
  if (highestSeverity === 'warning') return 'warning'
  if (highestSeverity === 'info') return 'info'
  if (process.activeIncidentCount > 0) return 'info'
  return 'none'
}

function toDominantAlertLabel(
  process: ProcessSummaryVM,
  t: (key: string, opts?: Record<string, unknown>) => string,
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  const dominantIncident = process.dominantIncident
  if (dominantIncident === null) {
    return t(keys.dashboard.table.dominantAlertLabel.noAlerts)
  }

  return t(dominantIncident.factMessageKey, dominantIncident.factMessageParams)
}

function toSeverityBadgeClasses(severity: DashboardProcessSeverity): string {
  if (severity === 'danger')
    return 'border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg'
  if (severity === 'warning')
    return 'border-tone-warning-border bg-tone-warning-bg text-tone-warning-fg'
  if (severity === 'info') return 'border-tone-info-border bg-tone-info-bg text-tone-info-fg'
  if (severity === 'success')
    return 'border-tone-success-border bg-tone-success-bg text-tone-success-fg'
  return 'border-border bg-surface-muted text-text-muted'
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

function displayTruncatedText(value: string | null): string {
  return value ?? '—'
}

// ---------------------------------------------------------------------------
// Arrow icon (route)
// ---------------------------------------------------------------------------

function ArrowIcon(): JSX.Element {
  return (
    <svg
      class="h-3.5 w-3.5 shrink-0 text-text-muted"
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
        class="inline-flex h-4 w-4 items-center justify-center text-text-muted"
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
        isActive()
          ? 'text-primary'
          : 'text-text-muted hover:text-primary focus-visible:text-primary'
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
  if (days >= 4) agingClass = 'text-tone-danger-fg'
  else if (days >= 1) agingClass = 'text-tone-warning-fg'
  else agingClass = 'text-text-muted'

  return { label, agingClass }
}

// ---------------------------------------------------------------------------
// Cell renderers — one per column, each receives the full row context
// ---------------------------------------------------------------------------

type CellContext = {
  readonly process: ProcessSummaryVM
  readonly processHref: string
  readonly handleProcessLinkClick: (event: MouseEvent) => void
  readonly t: (key: string, opts?: Record<string, unknown>) => string
  readonly keys: ReturnType<typeof useTranslation>['keys']
  readonly onProcessSync: (processId: string) => Promise<void>
}

function ProcessRefCell(ctx: CellContext): JSX.Element {
  return (
    <div class="min-w-0 overflow-hidden px-(--dashboard-table-cell-px) py-(--dashboard-table-cell-py)">
      <A
        href={ctx.processHref}
        class="row-link block truncate text-sm-ui font-semibold leading-tight tracking-[-0.01em] text-primary hover:text-primary-hover"
        onClick={ctx.handleProcessLinkClick}
      >
        {displayProcessRef(ctx.process)}
      </A>
    </div>
  )
}

function CarrierCell(ctx: CellContext): JSX.Element {
  return (
    <div class="min-w-0 overflow-hidden px-(--dashboard-table-cell-px) py-(--dashboard-table-cell-py)">
      <A
        href={ctx.processHref}
        class="row-link block truncate text-sm-ui leading-tight text-foreground"
        onClick={ctx.handleProcessLinkClick}
      >
        {displayTruncatedText(toCarrierDisplayLabel(ctx.process.carrier))}
      </A>
    </div>
  )
}

function ImporterCell(ctx: CellContext): JSX.Element {
  return (
    <div class="min-w-0 overflow-hidden px-(--dashboard-table-cell-px) py-(--dashboard-table-cell-py)">
      <A
        href={ctx.processHref}
        class="row-link block truncate text-sm-ui leading-tight text-foreground"
        onClick={ctx.handleProcessLinkClick}
      >
        {displayTruncatedText(ctx.process.importerName)}
      </A>
    </div>
  )
}

function ExporterCell(ctx: CellContext): JSX.Element {
  return (
    <div class="min-w-0 overflow-hidden px-(--dashboard-table-cell-px) py-(--dashboard-table-cell-py)">
      <A
        href={ctx.processHref}
        class="row-link block truncate text-sm-ui leading-tight text-foreground"
        onClick={ctx.handleProcessLinkClick}
      >
        {displayTruncatedText(ctx.process.exporterName)}
      </A>
    </div>
  )
}

function RouteCell(ctx: CellContext): JSX.Element {
  const route = () => displayRoute(ctx.process)
  return (
    <div class="min-w-0 overflow-hidden px-(--dashboard-table-cell-px) py-(--dashboard-table-cell-py)">
      <A href={ctx.processHref} class="row-link block" onClick={ctx.handleProcessLinkClick}>
        <div class="flex min-w-0 items-center gap-1.5 text-xs-ui leading-tight text-text-muted">
          <span class="truncate">{route().origin}</span>
          <ArrowIcon />
          <span class="truncate text-sm-ui font-medium text-foreground">{route().destination}</span>
          <Show when={ctx.process.redestinationNumber}>
            <span class="shrink-0 text-micro text-text-muted">
              ({ctx.process.redestinationNumber})
            </span>
          </Show>
        </div>
      </A>
    </div>
  )
}

function StatusCell(ctx: CellContext): JSX.Element {
  const display = createDashboardStatusCellDisplayMemo({
    getCommand: () => ({
      source: {
        status: ctx.process.status,
        statusCode: ctx.process.statusCode,
        statusMicrobadge: ctx.process.statusMicrobadge,
      },
      t: ctx.t,
      keys: ctx.keys,
    }),
  })
  const primary = () => display().primary
  const subtitle = () => display().subtitle

  return (
    <div class="flex min-w-0 items-center justify-center overflow-hidden px-(--dashboard-table-cell-px) py-(--dashboard-table-cell-py)">
      <A
        href={ctx.processHref}
        class="row-link inline-flex max-w-full items-center"
        onClick={ctx.handleProcessLinkClick}
      >
        <div class="inline-flex max-w-full flex-col items-start leading-tight">
          <StatusBadge variant={primary().variant} label={primary().label} />
          <Show when={subtitle()}>
            {(subtitleDisplay) => (
              <span
                class={`mt-1 max-w-full truncate whitespace-nowrap text-xs-ui font-medium leading-tight ${subtitleDisplay().textClass}`}
              >
                {subtitleDisplay().label}
              </span>
            )}
          </Show>
        </div>
      </A>
    </div>
  )
}

function EtaCell(ctx: CellContext): JSX.Element {
  const isDateEta = () => ctx.process.etaDisplay.kind === 'date'
  const isDelayedDateEta = () => isDateEta() && ctx.process.status === 'delayed'

  return (
    <div class="min-w-0 overflow-hidden px-(--dashboard-table-cell-px) py-(--dashboard-table-cell-py) text-center">
      <A href={ctx.processHref} class="row-link block" onClick={ctx.handleProcessLinkClick}>
        <Show
          when={isDateEta()}
          fallback={
            <span class="text-xs-ui font-medium leading-tight text-text-muted">
              {toDashboardEtaCellLabel(ctx.process.etaDisplay, ctx.t, ctx.keys)}
            </span>
          }
        >
          <span
            class={`text-sm-ui font-semibold tabular-nums ${isDelayedDateEta() ? 'text-tone-danger-fg' : 'text-foreground'}`}
          >
            {toDashboardEtaCellLabel(ctx.process.etaDisplay, ctx.t, ctx.keys)}
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

function AlertsSummaryBadge(props: {
  readonly dominantSeverity: DashboardProcessSeverity
  readonly dominantAlertLabel: string
  readonly severityLabel: string
  readonly alertTooltip: string | undefined
  readonly incidentCount: number
}): JSX.Element {
  return (
    <Show
      when={props.dominantSeverity !== 'none'}
      fallback={
        <span
          class="text-xs-ui text-tone-success-strong"
          role="img"
          aria-label={props.dominantAlertLabel}
        >
          <Check class="w-3.5 h-3.5" aria-hidden="true" />
        </span>
      }
    >
      <span
        class={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-micro font-bold leading-none cursor-default ${toSeverityBadgeClasses(
          props.dominantSeverity,
        )}`}
        title={props.alertTooltip}
      >
        <span aria-hidden="true">{toUnifiedAlertIcon(props.dominantSeverity)}</span>
        {props.incidentCount}
        <span class="sr-only">{`${props.severityLabel}: ${props.dominantAlertLabel}`}</span>
      </span>
    </Show>
  )
}

function TrackingValidationChip(props: {
  readonly visible: boolean
  readonly label: string
  readonly chipLabel: string
  readonly severity: ProcessSummaryVM['trackingValidation']['highestSeverity']
}): JSX.Element {
  const displayState = () =>
    toTrackingValidationDisplayState({
      hasIssues: props.visible,
      highestSeverity: props.severity,
    })

  return (
    <Show when={props.visible}>
      <span
        class={`inline-flex items-center rounded border px-1.5 py-0.5 text-micro font-semibold leading-none whitespace-nowrap ${toTrackingValidationBadgeClasses(
          displayState(),
        )}`}
        title={props.label}
      >
        {props.chipLabel}
      </span>
    </Show>
  )
}

function AlertsCell(ctx: CellContext): JSX.Element {
  const dominantSeverity = () => toAlertBadgeSeverity(ctx.process)
  const dominantAlertLabel = () => toDominantAlertLabel(ctx.process, ctx.t, ctx.keys)
  const hasTrackingValidation = () => ctx.process.trackingValidation.hasIssues
  const trackingValidationLabel = () => {
    const affectedCount = ctx.process.trackingValidation.affectedContainerCount
    if (affectedCount > 1) {
      return ctx.t(ctx.keys.dashboard.table.trackingValidation.affectedMultiple, {
        count: affectedCount,
      })
    }

    return ctx.t(ctx.keys.dashboard.table.trackingValidation.affectedSingle)
  }
  const trackingValidationTooltip = () => {
    const trackingValidationCopyLabels: TrackingValidationCopyLabels = {
      areaLabel: ctx.t(ctx.keys.shipmentView.validation.labels.area),
      blockLabel: ctx.t(ctx.keys.shipmentView.validation.labels.block),
      locationLabel: ctx.t(ctx.keys.shipmentView.validation.labels.location),
      affectedAreaLabels: {
        container: ctx.t(ctx.keys.shipmentView.validation.areas.container),
        operational: ctx.t(ctx.keys.shipmentView.validation.areas.operational),
        process: ctx.t(ctx.keys.shipmentView.validation.areas.process),
        series: ctx.t(ctx.keys.shipmentView.validation.areas.series),
        status: ctx.t(ctx.keys.shipmentView.validation.areas.status),
        timeline: ctx.t(ctx.keys.shipmentView.validation.areas.timeline),
      },
    }

    return toTrackingValidationTooltipText({
      aggregateLabel: trackingValidationLabel(),
      issue: ctx.process.trackingValidation.topIssue,
      labels: trackingValidationCopyLabels,
      resolveBlockLabel: (key) => ctx.t(key),
      resolveReason: (key) => ctx.t(key),
    })
  }

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
      triggeredAtIso: ctx.process.dominantIncident?.triggeredAt ?? null,
      t: ctx.t,
      keys: ctx.keys,
    })

  const alertTooltip = (): string | undefined => {
    if (dominantSeverity() === 'none') return undefined
    const parts: string[] = [dominantAlertLabel()]
    const age = alertAge()
    if (age) parts.push(`· ${age.label}`)
    parts.push(
      ctx.t(ctx.keys.dashboard.table.alertTooltip.additionalAlerts, {
        count: ctx.process.affectedContainerCount,
      }),
    )
    return parts.join('\n')
  }

  return (
    <div class="min-w-0 overflow-hidden px-(--dashboard-table-cell-px) py-(--dashboard-table-cell-py) text-center">
      <A
        href={ctx.processHref}
        class="row-link flex justify-center"
        onClick={ctx.handleProcessLinkClick}
      >
        <div class="flex items-center justify-center gap-1">
          <AlertsSummaryBadge
            dominantSeverity={dominantSeverity()}
            dominantAlertLabel={dominantAlertLabel()}
            severityLabel={severityLabel()}
            alertTooltip={alertTooltip()}
            incidentCount={ctx.process.activeIncidentCount}
          />
          <TrackingValidationChip
            visible={hasTrackingValidation()}
            label={trackingValidationTooltip()}
            chipLabel={ctx.t(ctx.keys.dashboard.table.trackingValidation.chip)}
            severity={ctx.process.trackingValidation.highestSeverity}
          />
        </div>
      </A>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cell dispatcher
// ---------------------------------------------------------------------------

const CELL_RENDERERS: Record<DashboardColumnId, (ctx: CellContext) => JSX.Element> = {
  processRef: ProcessRefCell,
  carrier: CarrierCell,
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
  const translate = (key: string, options?: Record<string, unknown>): string =>
    options === undefined ? t(key) : t(key, options)
  const processHref = () => buildProcessHref(props.process.id)
  const dominantSeverity = () => toDominantSeverity(props.process)

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
    t: translate,
    keys,
    onProcessSync: props.onProcessSync,
  })

  return (
    // biome-ignore lint/a11y/useSemanticElements: Row-level delegated navigation must coexist with internal interactive controls, which prevents using a single semantic <button>/<a> wrapper.
    <div
      role="button"
      tabIndex={0}
      data-dashboard-process-id={props.process.id}
      data-dashboard-last-opened={props.isHighlighted ? 'true' : undefined}
      class={toDashboardProcessRowClass({
        severity: dominantSeverity(),
        isHighlighted: props.isHighlighted,
      })}
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
    carrier: keys.dashboard.table.col.carrier,
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
      class="grid min-h-(--dashboard-table-header-height) border-b border-border bg-surface-muted text-left text-sm-ui font-semibold leading-tight tracking-[0.01em] text-text-muted"
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
              class={`min-h-(--dashboard-table-header-height) px-(--dashboard-table-cell-px) py-(--dashboard-table-cell-py) ${alignClass()} ${colDef.reorderable ? 'cursor-grab' : ''} ${isDragTarget() ? 'bg-surface' : ''}`}
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

  /** Default priority ordering: severity desc → incident count desc → affected containers desc. */
  const prioritySorted = (): readonly ProcessSummaryVM[] => {
    if (props.sortSelection !== null) return props.processes
    return [...props.processes].sort((a, b) => {
      const sevDiff = SEVERITY_ORDER[toDominantSeverity(a)] - SEVERITY_ORDER[toDominantSeverity(b)]
      if (sevDiff !== 0) return sevDiff
      const incidentDiff = b.activeIncidentCount - a.activeIncidentCount
      if (incidentDiff !== 0) return incidentDiff
      return b.affectedContainerCount - a.affectedContainerCount
    })
  }

  return (
    <div class="overflow-x-auto">
      <DashboardTableHeader
        columnOrder={props.columnOrder}
        gridStyle={gridStyle()}
        sortSelection={props.sortSelection}
        onSortToggle={props.onSortToggle}
        onColumnReorder={props.onColumnReorder}
      />
      <div>
        <For each={prioritySorted()}>
          {(process) => (
            <DashboardProcessRow
              process={process}
              isHighlighted={process.id === props.highlightedProcessId}
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

function toTableSkeletonWidth(columnId: DashboardColumnId): string {
  switch (columnId) {
    case 'processRef':
      return 'w-24'
    case 'carrier':
      return 'w-20'
    case 'importer':
    case 'exporter':
      return 'w-28'
    case 'route':
      return 'w-32'
    case 'status':
      return 'w-24'
    case 'eta':
      return 'w-20'
    case 'sync':
      return 'mx-auto w-8'
    case 'alerts':
      return 'mx-auto w-10'
  }
}

function DashboardProcessTableSkeleton(props: {
  readonly columnOrder: readonly DashboardColumnId[]
}): JSX.Element {
  const gridStyle = createMemo(() => buildGridTemplate(props.columnOrder))

  return (
    <div class="overflow-x-auto" aria-hidden="true">
      <div
        class="grid min-h-(--dashboard-table-header-height) border-b border-border bg-surface-muted"
        style={{ 'grid-template-columns': gridStyle() }}
      >
        <For each={props.columnOrder}>
          {(columnId) => (
            <div class="min-h-(--dashboard-table-header-height) px-(--dashboard-table-cell-px) py-(--dashboard-table-cell-py)">
              <div
                class={`dashboard-skeleton-shimmer h-3 rounded bg-surface ${toTableSkeletonWidth(columnId)}`}
              />
            </div>
          )}
        </For>
      </div>

      <For each={DASHBOARD_TABLE_SKELETON_ROW_KEYS}>
        {(rowKey) => (
          <div
            class="grid min-h-(--dashboard-table-row-height) items-center border-b border-border/50 bg-surface last:border-b-0"
            style={{ 'grid-template-columns': gridStyle() }}
            data-skeleton-row={rowKey}
          >
            <For each={props.columnOrder}>
              {(columnId) => (
                <div class="px-(--dashboard-table-cell-px) py-(--dashboard-table-cell-py)">
                  <div
                    class={`dashboard-skeleton-shimmer h-4 rounded bg-surface-muted ${toTableSkeletonWidth(columnId)}`}
                  />
                </div>
              )}
            </For>
          </div>
        )}
      </For>
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
    if (props.initialLoading) {
      return <DashboardProcessTableSkeleton columnOrder={columnOrder()} />
    }

    if (props.hasError) {
      return (
        <div class="px-6 py-12 text-center text-md-ui text-tone-danger-fg">
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
        highlightedProcessId={props.highlightedProcessId}
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
    <section
      class="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgb(0_0_0_/8%)]"
      aria-busy={props.initialLoading || props.refreshing}
    >
      <header class="border-b border-border bg-surface-muted px-6 py-4">
        <div class="flex items-center gap-2">
          <h2 class="text-lg-ui font-semibold leading-tight tracking-[-0.01em] text-foreground">
            {t(keys.dashboard.table.title)}
          </h2>
          <Show when={props.initialLoading || props.refreshing}>
            <RefreshCw class="h-4 w-4 animate-spin text-text-muted" aria-hidden="true" />
          </Show>
        </div>
      </header>
      {content()}
    </section>
  )
}
