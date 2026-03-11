import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import type { AgentDetailVM } from '~/modules/agent/ui/vm/agent.vm'

type Props = {
  readonly vm: AgentDetailVM
}

export function AgentCapabilitiesCard(props: Props): JSX.Element {
  return (
    <section class="rounded-lg border border-border bg-surface">
      <header class="border-b border-border/60 px-3 py-2">
        <h2 class="text-micro font-semibold uppercase tracking-wider text-text-muted">
          Capabilities / Providers
        </h2>
      </header>
      <div class="flex flex-wrap gap-1.5 px-3 py-2.5">
        <For each={[...props.vm.capabilities]}>
          {(cap) => (
            <span class="inline-flex items-center rounded bg-surface-muted px-2 py-0.5 text-xs-ui font-medium text-foreground ring-1 ring-inset ring-border">
              {cap}
            </span>
          )}
        </For>
      </div>
    </section>
  )
}
