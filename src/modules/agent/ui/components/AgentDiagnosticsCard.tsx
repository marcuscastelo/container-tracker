import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { AgentStatusBadge } from '~/modules/agent/ui/components/AgentStatusBadge'
import type { AgentDetailVM } from '~/modules/agent/ui/vm/agent.vm'

type Props = {
  readonly vm: AgentDetailVM
}

export function AgentDiagnosticsCard(props: Props): JSX.Element {
  return (
    <section class="rounded-lg border border-border bg-surface">
      <header class="border-b border-border/60 px-3 py-2">
        <h2 class="text-micro font-semibold uppercase tracking-wider text-text-muted">
          Diagnostics
        </h2>
      </header>
      <div class="px-3 py-2.5">
        {/* Last error */}
        <Show when={props.vm.lastError}>
          {(error) => (
            <div class="mb-2 rounded border border-tone-danger-border bg-tone-danger-bg px-2.5 py-2">
              <span class="text-xs-ui font-semibold text-tone-danger-fg">Last Error</span>
              <p class="mt-0.5 break-all text-micro text-tone-danger-fg">{error()}</p>
            </div>
          )}
        </Show>

        <Show when={props.vm.lastUpdateError}>
          {(error) => (
            <div class="mb-2 rounded border border-tone-warning-border bg-tone-warning-bg px-2.5 py-2">
              <span class="text-xs-ui font-semibold text-tone-warning-fg">Last Update Error</span>
              <p class="mt-0.5 break-all text-micro text-tone-warning-fg">{error()}</p>
            </div>
          )}
        </Show>

        {/* Diagnostic flags */}
        <Show
          when={props.vm.diagnosticFlags.length > 0}
          fallback={
            <Show when={!props.vm.lastError}>
              <p class="text-sm-ui text-text-muted">No diagnostic issues detected</p>
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
