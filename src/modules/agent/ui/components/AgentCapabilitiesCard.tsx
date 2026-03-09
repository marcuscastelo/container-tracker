import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import type { AgentDetailVM } from '~/modules/agent/ui/vm/agent.vm'

type Props = {
  readonly vm: AgentDetailVM
}

export function AgentCapabilitiesCard(props: Props): JSX.Element {
  return (
    <section class="rounded-lg border border-slate-200 bg-white">
      <header class="border-b border-slate-100 px-3 py-2">
        <h2 class="text-micro font-semibold uppercase tracking-wider text-slate-400">
          Capabilities / Providers
        </h2>
      </header>
      <div class="flex flex-wrap gap-1.5 px-3 py-2.5">
        <For each={[...props.vm.capabilities]}>
          {(cap) => (
            <span class="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs-ui font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
              {cap}
            </span>
          )}
        </For>
      </div>
    </section>
  )
}
