import type { JSX } from 'solid-js'
import { createMemo } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'
import { MetricCard } from '~/shared/ui/MetricCard'

type MetricsInput = {
  readonly status: string
}

type Props = {
  readonly statuses: readonly MetricsInput[]
}

function ShipIcon(): JSX.Element {
  return (
    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  )
}

function ContainerIcon(): JSX.Element {
  return (
    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
      />
    </svg>
  )
}

function AlertIcon(): JSX.Element {
  return (
    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  )
}

function CheckIcon(): JSX.Element {
  return (
    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7" />
    </svg>
  )
}

export function DashboardMetricsGrid(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  const metrics = createMemo(() => {
    const activeCount = props.statuses.length
    const inTransitCount = props.statuses.filter(
      (entry) => entry.status === 'in-transit' || entry.status === 'loaded',
    ).length
    const delayCount = props.statuses.filter((entry) => entry.status === 'delayed').length
    const arrivingToday = props.statuses.filter(
      (entry) => entry.status === 'released' || entry.status === 'delivered',
    ).length

    return {
      activeCount,
      inTransitCount,
      delayCount,
      arrivingToday,
    }
  })

  return (
    <div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        icon={<ShipIcon />}
        label={t(keys.dashboard.metrics.activeShipments)}
        value={metrics().activeCount}
      />
      <MetricCard
        icon={<ContainerIcon />}
        label={t(keys.dashboard.metrics.inTransit)}
        value={metrics().inTransitCount}
      />
      <MetricCard
        icon={<AlertIcon />}
        label={t(keys.dashboard.metrics.delays)}
        value={metrics().delayCount}
        variant={metrics().delayCount > 0 ? 'warning' : 'default'}
      />
      <MetricCard
        icon={<CheckIcon />}
        label={t(keys.dashboard.metrics.arrivalsToday)}
        value={metrics().arrivingToday}
        variant={metrics().arrivingToday > 0 ? 'success' : 'default'}
      />
    </div>
  )
}
