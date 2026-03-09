import type { JSX } from 'solid-js'
import type { AgentDetailVM } from '~/modules/agent/ui/vm/agent.vm'

type Props = {
  readonly vm: AgentDetailVM
}

function Metric(props: {
  readonly label: string
  readonly value: string | number
  readonly danger?: boolean
}): JSX.Element {
  return (
    <div class="flex flex-col items-center gap-0 py-2">
      <span
        class={`text-xl-ui font-bold tabular-nums leading-tight ${props.danger ? 'text-red-600' : 'text-slate-900'}`}
      >
        {props.value}
      </span>
      <span class="text-micro font-medium text-slate-500">{props.label}</span>
    </div>
  )
}

export function AgentMetricsCard(props: Props): JSX.Element {
  return (
    <section class="rounded-lg border border-slate-200 bg-white">
      <header class="border-b border-slate-100 px-3 py-2">
        <h2 class="text-micro font-semibold uppercase tracking-wider text-slate-400">
          Activity Metrics
        </h2>
      </header>
      <div class="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3">
        <div class="bg-white px-3">
          <Metric label="Active Jobs" value={props.vm.activeJobs} />
        </div>
        <div class="bg-white px-3">
          <Metric label="Jobs / 1h" value={props.vm.jobsLastHour} />
        </div>
        <div class="bg-white px-3">
          <Metric
            label="Failures / 1h"
            value={props.vm.failuresLastHour}
            danger={props.vm.failuresLastHour > 0}
          />
        </div>
        <div class="bg-white px-3">
          <Metric label="Avg Duration" value={props.vm.avgJobDurationDisplay} />
        </div>
        <div class="bg-white px-3">
          <Metric label="Queue Lag" value={props.vm.queueLagDisplay} />
        </div>
      </div>
    </section>
  )
}
