import type { JSX } from 'solid-js'
import type { AgentDetailVM } from '~/modules/agent/ui/vm/agent.vm'

type Props = {
  readonly vm: AgentDetailVM
}

function Row(props: { readonly label: string; readonly children: JSX.Element }): JSX.Element {
  return (
    <div class="flex items-baseline justify-between gap-2 py-1">
      <span class="shrink-0 text-xs-ui font-medium text-slate-500">{props.label}</span>
      <span class="text-right text-sm-ui text-slate-900">{props.children}</span>
    </div>
  )
}

export function AgentIdentityCard(props: Props): JSX.Element {
  return (
    <section class="rounded-lg border border-slate-200 bg-white">
      <header class="border-b border-slate-100 px-3 py-2">
        <h2 class="text-micro font-semibold uppercase tracking-wider text-slate-400">Identity</h2>
      </header>
      <div class="divide-y divide-slate-50 px-3">
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
          <span class="ml-1 text-micro text-slate-400">({props.vm.lastSeenRelative})</span>
        </Row>
      </div>
    </section>
  )
}
