import type { JSX } from 'solid-js'
import { createMemo } from 'solid-js'
import type { AgentStatusTone } from '~/modules/agent/ui/vm/agent.vm'

type Props = {
  readonly label: string
  readonly tone: AgentStatusTone
}

const toneStyles: Record<AgentStatusTone, { dot: string; bg: string; text: string }> = {
  success: {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50 ring-emerald-500/20',
    text: 'text-emerald-700',
  },
  warning: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-50 ring-amber-500/20',
    text: 'text-amber-700',
  },
  danger: {
    dot: 'bg-red-500',
    bg: 'bg-red-50 ring-red-500/20',
    text: 'text-red-700',
  },
  neutral: {
    dot: 'bg-slate-400',
    bg: 'bg-slate-50 ring-slate-400/20',
    text: 'text-slate-600',
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
