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

export function AgentEnrollmentCard(props: Props): JSX.Element {
  return (
    <section class="rounded-lg border border-slate-200 bg-white">
      <header class="border-b border-slate-100 px-3 py-2">
        <h2 class="text-micro font-semibold uppercase tracking-wider text-slate-400">
          Enrollment &amp; Config
        </h2>
      </header>
      <div class="divide-y divide-slate-50 px-3">
        <Row label="Method">{props.vm.enrollmentMethodLabel}</Row>
        <Row label="Token">
          <span class="font-mono text-micro">{props.vm.tokenIdMasked}</span>
        </Row>
        <Row label="Interval">{props.vm.intervalDisplay}</Row>
        <Row label="Current Ver">{props.vm.currentVersion}</Row>
        <Row label="Desired Ver">{props.vm.desiredVersion ?? '—'}</Row>
        <Row label="Channel">{props.vm.updateChannel}</Row>
        <Row label="Updater">{props.vm.updaterStateLabel}</Row>
        <Row label="Last Check">{props.vm.updaterLastCheckedDisplay}</Row>
        <Row label="Enrolled">{props.vm.enrolledAtDisplay}</Row>
      </div>
    </section>
  )
}
