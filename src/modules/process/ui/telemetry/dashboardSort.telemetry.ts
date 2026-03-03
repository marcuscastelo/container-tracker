import type {
  DashboardSortDirection,
  DashboardSortField,
  DashboardSortSelection,
} from '~/modules/process/ui/viewmodels/dashboard-sort.vm'

export const DASHBOARD_SORT_CHANGED_EVENT = 'dashboard_sort_changed' as const

export type DashboardSortChangeSource = 'user' | 'restore'

export type DashboardSortChangedTelemetryPayload = {
  readonly field: DashboardSortField
  readonly direction: DashboardSortDirection | null
}

export type DashboardSortTelemetryEmitter = (
  eventName: typeof DASHBOARD_SORT_CHANGED_EVENT,
  payload: DashboardSortChangedTelemetryPayload,
) => void

function emitDashboardSortTelemetryToWindow(
  eventName: typeof DASHBOARD_SORT_CHANGED_EVENT,
  payload: DashboardSortChangedTelemetryPayload,
): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(eventName, { detail: payload }))
}

function toDashboardSortChangedTelemetryPayload(
  field: DashboardSortField,
  nextSelection: DashboardSortSelection,
): DashboardSortChangedTelemetryPayload {
  return {
    field,
    direction: nextSelection?.field === field ? nextSelection.direction : null,
  }
}

export function emitDashboardSortChangedTelemetry(
  source: DashboardSortChangeSource,
  field: DashboardSortField,
  nextSelection: DashboardSortSelection,
  emitEvent: DashboardSortTelemetryEmitter = emitDashboardSortTelemetryToWindow,
): void {
  if (source !== 'user') return

  emitEvent(
    DASHBOARD_SORT_CHANGED_EVENT,
    toDashboardSortChangedTelemetryPayload(field, nextSelection),
  )
}
