import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_SORT_CHANGED_EVENT,
  type DashboardSortChangedTelemetryPayload,
  type DashboardSortTelemetryEmitter,
  emitDashboardSortChangedTelemetry,
} from '~/modules/process/ui/telemetry/dashboardSort.telemetry'
import { nextDashboardSortSelection } from '~/modules/process/ui/viewmodels/dashboard-sort.service'
import type { DashboardSortSelection } from '~/modules/process/ui/viewmodels/dashboard-sort.vm'

type TelemetryCall = {
  readonly eventName: string
  readonly payload: DashboardSortChangedTelemetryPayload
}

function createTelemetryCapture(): {
  readonly calls: TelemetryCall[]
  readonly emitEvent: DashboardSortTelemetryEmitter
} {
  const calls: TelemetryCall[] = []

  return {
    calls,
    emitEvent: (eventName, payload) => {
      calls.push({ eventName, payload })
    },
  }
}

describe('dashboard sort telemetry', () => {
  it('emits dashboard_sort_changed with exact payload for user-triggered sort changes', () => {
    const capture = createTelemetryCapture()

    emitDashboardSortChangedTelemetry(
      'user',
      'provider',
      {
        field: 'provider',
        direction: 'desc',
      },
      capture.emitEvent,
    )

    expect(capture.calls).toEqual([
      {
        eventName: DASHBOARD_SORT_CHANGED_EVENT,
        payload: {
          field: 'provider',
          direction: 'desc',
        },
      },
    ])
  })

  it('keeps payload shape when user clears active sort', () => {
    const capture = createTelemetryCapture()

    emitDashboardSortChangedTelemetry('user', 'provider', null, capture.emitEvent)

    expect(capture.calls).toEqual([
      {
        eventName: DASHBOARD_SORT_CHANGED_EVENT,
        payload: {
          field: 'provider',
          direction: null,
        },
      },
    ])
  })

  it('does not emit telemetry for initial restoration flow', () => {
    const capture = createTelemetryCapture()

    emitDashboardSortChangedTelemetry(
      'restore',
      'status',
      {
        field: 'status',
        direction: 'asc',
      },
      capture.emitEvent,
    )

    expect(capture.calls).toEqual([])
  })

  it('emits exactly one event per user sort action with UI-matching direction', () => {
    const capture = createTelemetryCapture()

    let selection: DashboardSortSelection = null

    selection = nextDashboardSortSelection(selection, 'provider')
    emitDashboardSortChangedTelemetry('user', 'provider', selection, capture.emitEvent)

    selection = nextDashboardSortSelection(selection, 'provider')
    emitDashboardSortChangedTelemetry('user', 'provider', selection, capture.emitEvent)

    selection = nextDashboardSortSelection(selection, 'provider')
    emitDashboardSortChangedTelemetry('user', 'provider', selection, capture.emitEvent)

    expect(capture.calls).toEqual([
      {
        eventName: DASHBOARD_SORT_CHANGED_EVENT,
        payload: {
          field: 'provider',
          direction: 'desc',
        },
      },
      {
        eventName: DASHBOARD_SORT_CHANGED_EVENT,
        payload: {
          field: 'provider',
          direction: 'asc',
        },
      },
      {
        eventName: DASHBOARD_SORT_CHANGED_EVENT,
        payload: {
          field: 'provider',
          direction: null,
        },
      },
    ])
  })
})
