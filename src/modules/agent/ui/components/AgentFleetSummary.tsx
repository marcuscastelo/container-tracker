import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import type { AgentFleetSummaryVM } from '~/modules/agent/ui/vm/agent.vm'

type Props = {
  readonly summary: AgentFleetSummaryVM | null
  readonly loading: boolean
}

function Metric(props: {
  readonly label: string
  readonly value: string | number
  readonly tone?: 'default' | 'success' | 'warning' | 'danger'
}): JSX.Element {
  const valueColor = () => {
    switch (props.tone) {
      case 'success':
        return 'text-emerald-700'
      case 'warning':
        return 'text-amber-700'
      case 'danger':
        return 'text-red-700'
      default:
        return 'text-slate-900'
    }
  }

  return (
    <div class="flex flex-col items-center gap-0 px-3 py-2">
      <span class={`text-xl-ui font-bold tabular-nums leading-tight ${valueColor()}`}>
        {props.value}
      </span>
      <span class="text-micro font-medium text-slate-500">{props.label}</span>
    </div>
  )
}

function SkeletonMetric(): JSX.Element {
  return (
    <div class="flex flex-col items-center gap-1 px-3 py-2">
      <div class="h-6 w-8 animate-pulse rounded bg-slate-200" />
      <div class="h-3 w-14 animate-pulse rounded bg-slate-100" />
    </div>
  )
}

export function AgentFleetSummary(props: Props): JSX.Element {
  return (
    <div class="mb-4 flex flex-wrap items-stretch justify-center gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      <Show
        when={!props.loading && props.summary}
        fallback={
          <>
            <div class="bg-white">
              <SkeletonMetric />
            </div>
            <div class="bg-white">
              <SkeletonMetric />
            </div>
            <div class="bg-white">
              <SkeletonMetric />
            </div>
            <div class="bg-white">
              <SkeletonMetric />
            </div>
            <div class="bg-white">
              <SkeletonMetric />
            </div>
            <div class="bg-white">
              <SkeletonMetric />
            </div>
            <div class="bg-white">
              <SkeletonMetric />
            </div>
            <div class="bg-white">
              <SkeletonMetric />
            </div>
          </>
        }
      >
        {(summary) => (
          <>
            <div class="bg-white">
              <Metric label="Total" value={summary().totalAgents} />
            </div>
            <div class="bg-white">
              <Metric label="Connected" value={summary().connected} tone="success" />
            </div>
            <div class="bg-white">
              <Metric
                label="Degraded"
                value={summary().degraded}
                tone={summary().degraded > 0 ? 'warning' : 'default'}
              />
            </div>
            <div class="bg-white">
              <Metric
                label="Disconnected"
                value={summary().disconnected}
                tone={summary().disconnected > 0 ? 'danger' : 'default'}
              />
            </div>
            <div class="bg-white">
              <Metric label="Active Jobs" value={summary().totalActiveJobs} />
            </div>
            <div class="bg-white">
              <Metric
                label="Failures/1h"
                value={summary().failuresLastHour}
                tone={summary().failuresLastHour > 0 ? 'danger' : 'default'}
              />
            </div>
            <div class="bg-white">
              <Metric label="Max Lag" value={summary().maxQueueLagDisplay} />
            </div>
            <div class="bg-white">
              <Metric label="Tenants" value={summary().tenantCount} />
            </div>
          </>
        )}
      </Show>
    </div>
  )
}
