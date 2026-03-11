import type { JSX } from 'solid-js'
import type { AgentDetailVM } from '~/modules/agent/ui/vm/agent.vm'

type Props = {
  readonly vm: AgentDetailVM
}

function Row(props: { readonly label: string; readonly children: JSX.Element }): JSX.Element {
  return (
    <div class="flex items-baseline justify-between gap-2 py-1">
      <span class="shrink-0 text-xs-ui font-medium text-text-muted">{props.label}</span>
      <span class="text-right text-sm-ui text-foreground">{props.children}</span>
    </div>
  )
}

export function AgentIdentityCard(props: Props): JSX.Element {
  return (
    <section class="rounded-lg border border-border bg-surface">
      <header class="border-b border-border/60 px-3 py-2">
        <h2 class="text-micro font-semibold uppercase tracking-wider text-text-muted">Identity</h2>
      </header>
      <div class="divide-y divide-border/40 px-3">
        <Row label="Agent ID">
          <span class="font-mono text-micro">{props.vm.agentId}</span>
        </Row>
        <Row label="Hostname">
          <span class="font-mono text-micro break-all">{props.vm.hostname}</span>
        </Row>
        <Row label="Version">{props.vm.version}</Row>
        <Row label="Tenant">{props.vm.tenantName}</Row>
        <Row label="Tenant ID">
          <span class="font-mono text-micro">{props.vm.tenantId}</span>
        </Row>
        <Row label="Enrolled At">{props.vm.enrolledAtDisplay}</Row>
        <Row label="Last Seen">
          <span>{props.vm.lastSeenDisplay}</span>
          <span class="ml-1 text-micro text-text-muted">({props.vm.lastSeenRelative})</span>
        </Row>
      </div>
    </section>
  )
}
