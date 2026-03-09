import type { JSX } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import type { AgentStatusTone } from '~/modules/agent/ui/vm/agent.vm'

type Props = {
  readonly status: string
  readonly tone: AgentStatusTone
  readonly freshness: string
}

const toneBg: Record<AgentStatusTone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  neutral: 'bg-slate-400',
}

const freshnessPulse: Record<string, boolean> = {
  fresh: true,
  recent: false,
  stale: false,
  offline: false,
}

export function AgentRowStatus(props: Props): JSX.Element {
  const dotClass = createMemo(() => toneBg[props.tone])
  const shouldPulse = createMemo(() => freshnessPulse[props.freshness] ?? false)

  return (
    <div class="flex items-center gap-2">
      <span class="relative flex h-2.5 w-2.5">
        <Show when={shouldPulse()}>
          <span
            class={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotClass()}`}
          />
        </Show>
        <span class={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotClass()}`} />
      </span>
      <span class="text-sm-ui font-medium">{props.status}</span>
    </div>
  )
}
