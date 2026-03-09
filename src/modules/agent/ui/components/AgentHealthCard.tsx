import type { JSX } from 'solid-js'
import { createMemo } from 'solid-js'
import { AgentStatusBadge } from '~/modules/agent/ui/components/AgentStatusBadge'
import type { AgentDetailVM } from '~/modules/agent/ui/vm/agent.vm'

type Props = {
  readonly vm: AgentDetailVM
}

function Row(props: { readonly label: string; readonly children: JSX.Element }): JSX.Element {
  return (
    <div class="flex items-center justify-between gap-2 py-1">
      <span class="shrink-0 text-xs-ui font-medium text-slate-500">{props.label}</span>
      {props.children}
    </div>
  )
}

export function AgentHealthCard(props: Props): JSX.Element {
  const heartbeatColor = createMemo(() => {
    const map: Record<string, string> = {
      fresh: 'text-emerald-700',
      recent: 'text-slate-700',
      stale: 'text-amber-700',
      offline: 'text-red-700',
    }
    return map[props.vm.freshness] ?? 'text-red-700'
  })

  return (
    <section class="rounded-lg border border-slate-200 bg-white">
      <header class="border-b border-slate-100 px-3 py-2">
        <h2 class="text-micro font-semibold uppercase tracking-wider text-slate-400">
          Health &amp; Status
        </h2>
      </header>
      <div class="divide-y divide-slate-50 px-3">
        <Row label="Status">
          <AgentStatusBadge label={props.vm.status} tone={props.vm.statusTone} />
        </Row>
        <Row label="Heartbeat">
          <span class={`text-sm-ui font-medium ${heartbeatColor()}`}>
            {props.vm.lastSeenRelative}
          </span>
        </Row>
        <Row label="Realtime">
          <AgentStatusBadge label={props.vm.realtimeLabel} tone={props.vm.realtimeTone} />
        </Row>
        <Row label="Lease Health">
          <AgentStatusBadge label={props.vm.leaseHealthLabel} tone={props.vm.leaseHealthTone} />
        </Row>
        <Row label="Processing">
          <span class="text-sm-ui text-slate-700">{props.vm.processingStateLabel}</span>
        </Row>
      </div>
    </section>
  )
}
