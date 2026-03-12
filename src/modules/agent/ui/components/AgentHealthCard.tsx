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
      <span class="shrink-0 text-xs-ui font-medium text-text-muted">{props.label}</span>
      {props.children}
    </div>
  )
}

export function AgentHealthCard(props: Props): JSX.Element {
  const heartbeatColor = createMemo(() => {
    const map: Record<string, string> = {
      fresh: 'text-tone-success-fg',
      recent: 'text-foreground',
      stale: 'text-tone-warning-fg',
      offline: 'text-tone-danger-fg',
    }
    return map[props.vm.freshness] ?? 'text-tone-danger-fg'
  })

  return (
    <section class="rounded-lg border border-border bg-surface">
      <header class="border-b border-border/60 px-3 py-2">
        <h2 class="text-micro font-semibold uppercase tracking-wider text-text-muted">
          Health &amp; Status
        </h2>
      </header>
      <div class="divide-y divide-border/40 px-3">
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
        <Row label="Boot">
          <span class="text-sm-ui text-foreground">{props.vm.bootStatusLabel}</span>
        </Row>
        <Row label="Lease Health">
          <AgentStatusBadge label={props.vm.leaseHealthLabel} tone={props.vm.leaseHealthTone} />
        </Row>
        <Row label="Processing">
          <span class="text-sm-ui text-foreground">{props.vm.processingStateLabel}</span>
        </Row>
        <Row label="Restart Required">
          <span
            class={
              props.vm.restartRequired
                ? 'text-sm-ui font-semibold text-tone-warning-fg'
                : 'text-sm-ui text-foreground'
            }
          >
            {props.vm.restartRequired ? 'Yes' : 'No'}
          </span>
        </Row>
      </div>
    </section>
  )
}
