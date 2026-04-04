import { type Accessor, createEffect, createMemo, createResource, createSignal } from 'solid-js'
import { fetchNavbarAlertsSummary } from '~/shared/api/navbar-alerts/navbar-alerts.api'
import type { ResourceSnapshotLike } from '~/shared/solid/resourceSnapshot'
import { readResourceSnapshot } from '~/shared/solid/resourceSnapshot'
import { toNavbarAlertsVM } from '~/shared/ui/navbar-alerts/navbar-alerts.mapper'
import {
  EMPTY_NAVBAR_ALERTS_VM,
  type NavbarAlertsVM,
} from '~/shared/ui/navbar-alerts/navbar-alerts.vm'

type NavbarAlertsState = {
  readonly totalAlerts: number
  readonly processes: NavbarAlertsVM['processes']
  readonly loading: boolean
  readonly error: string | null
}

type UseNavbarAlertsResult = {
  readonly state: Accessor<NavbarAlertsState>
  readonly hasResolved: Accessor<boolean>
  readonly refresh: () => Promise<void>
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return 'Failed to load navbar alerts'
}

export function toNavbarAlertsState(
  resource: ResourceSnapshotLike<NavbarAlertsVM | undefined> & {
    readonly loading: boolean
    readonly error: unknown
  },
): NavbarAlertsState {
  const vm = readResourceSnapshot(resource) ?? EMPTY_NAVBAR_ALERTS_VM

  return {
    totalAlerts: vm.totalAlerts,
    processes: vm.processes,
    loading: resource.loading,
    error: resource.error ? toErrorMessage(resource.error) : null,
  }
}

export function hasResolvedNavbarAlertsResource(
  resource: ResourceSnapshotLike<NavbarAlertsVM | undefined> & {
    readonly error: unknown
  },
): boolean {
  return readResourceSnapshot(resource) !== undefined || Boolean(resource.error)
}

export function useNavbarAlerts(): UseNavbarAlertsResult {
  let shouldPreferCached = true
  const [hasResolved, setHasResolved] = createSignal(false)

  const [resource, { refetch }] = createResource(async () => {
    const response = await fetchNavbarAlertsSummary({
      preferCached: shouldPreferCached,
    })
    shouldPreferCached = false
    return toNavbarAlertsVM(response)
  })

  const state = createMemo<NavbarAlertsState>(() => toNavbarAlertsState(resource))

  createEffect(() => {
    if (hasResolvedNavbarAlertsResource(resource)) {
      setHasResolved(true)
    }
  })

  const refresh = async () => {
    await refetch()
  }

  return {
    state,
    hasResolved,
    refresh,
  }
}
