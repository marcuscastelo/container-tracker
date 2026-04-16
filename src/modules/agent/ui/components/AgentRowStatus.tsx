import type { JSX } from 'solid-js'
import { createMemo } from 'solid-js'
import type { AgentStatusTone } from '~/modules/agent/ui/vm/agent.vm'

type Props = {
  readonly status: string
  readonly tone: AgentStatusTone
  readonly freshness: string
}

const toneBg: Record<AgentStatusTone, string> = {
  success: 'bg-tone-success-strong',
  warning: 'bg-tone-warning-strong',
  danger: 'bg-tone-danger-strong',
  neutral: 'bg-text-muted',
}

export function AgentRowStatus(props: Props): JSX.Element {
  const dotClass = createMemo(() => toneBg[props.tone])

  return (
    <div class="flex items-center gap-2" data-freshness={props.freshness}>
      <span
        class={`inline-flex h-2.5 w-2.5 rounded-full shadow-[0_0_0_3px_rgb(15_23_42_/0.06)] ${dotClass()}`}
      />
      <span class="text-sm-ui font-medium">{props.status}</span>
    </div>
  )
}
