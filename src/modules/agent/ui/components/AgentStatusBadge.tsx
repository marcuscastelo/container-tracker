import type { JSX } from 'solid-js'
import { createMemo } from 'solid-js'
import type { AgentStatusTone } from '~/modules/agent/ui/vm/agent.vm'

type Props = {
  readonly label: string
  readonly tone: AgentStatusTone
}

const toneStyles: Record<AgentStatusTone, { dot: string; bg: string; text: string }> = {
  success: {
    dot: 'bg-tone-success-strong',
    bg: 'bg-tone-success-bg ring-tone-success-border/30',
    text: 'text-tone-success-fg',
  },
  warning: {
    dot: 'bg-tone-warning-strong',
    bg: 'bg-tone-warning-bg ring-tone-warning-border/30',
    text: 'text-tone-warning-fg',
  },
  danger: {
    dot: 'bg-tone-danger-strong',
    bg: 'bg-tone-danger-bg ring-tone-danger-border/30',
    text: 'text-tone-danger-fg',
  },
  neutral: {
    dot: 'bg-text-muted',
    bg: 'bg-surface-muted ring-border/40',
    text: 'text-text-muted',
  },
}

export function AgentStatusBadge(props: Props): JSX.Element {
  const styles = createMemo(() => toneStyles[props.tone])

  return (
    <span
      class={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs-ui font-semibold leading-none ring-1 ring-inset ${styles().bg} ${styles().text}`}
    >
      <span class={`h-1.5 w-1.5 rounded-full ${styles().dot}`} aria-hidden="true" />
      {props.label}
    </span>
  )
}
