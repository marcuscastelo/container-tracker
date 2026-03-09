import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { AgentStatusBadge } from '~/modules/agent/ui/components/AgentStatusBadge'
import type { AgentDetailVM } from '~/modules/agent/ui/vm/agent.vm'

type Props = {
  readonly vm: AgentDetailVM
}

export function AgentDiagnosticsCard(props: Props): JSX.Element {
  return (
    <section class="rounded-lg border border-slate-200 bg-white">
      <header class="border-b border-slate-100 px-3 py-2">
        <h2 class="text-micro font-semibold uppercase tracking-wider text-slate-400">
          Diagnostics
        </h2>
      </header>
      <div class="px-3 py-2.5">
        {/* Last error */}
        <Show when={props.vm.lastError}>
          {(error) => (
            <div class="mb-2 rounded border border-red-200 bg-red-50 px-2.5 py-2">
              <span class="text-xs-ui font-semibold text-red-700">Last Error</span>
              <p class="mt-0.5 break-all text-micro text-red-600">{error()}</p>
            </div>
          )}
        </Show>

        {/* Diagnostic flags */}
        <Show
          when={props.vm.diagnosticFlags.length > 0}
          fallback={
            <Show when={!props.vm.lastError}>
              <p class="text-sm-ui text-slate-400">No diagnostic issues detected</p>
            </Show>
          }
        >
          <div class="flex flex-wrap gap-1.5">
            <For each={[...props.vm.diagnosticFlags]}>
              {(flag) => <AgentStatusBadge label={flag.label} tone={flag.tone} />}
            </For>
          </div>
        </Show>
      </div>
    </section>
  )
}
