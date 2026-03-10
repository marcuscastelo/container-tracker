import type { JSX } from 'solid-js'
import { createMemo } from 'solid-js'

export type StatusVariant =
  | 'in-transit'
  | 'delayed'
  | 'loaded'
  | 'customs'
  | 'released'
  | 'delivered'
  | 'partial'
  | 'pending'
  | 'unknown'

type Props = {
  readonly variant: StatusVariant
  readonly label: string
  readonly neutral?: boolean
}

const statusConfig: Record<StatusVariant, { icon: string; bgClass: string; textClass: string; ringClass: string }> = {
  'in-transit': {
    icon: '●',
    bgClass: 'bg-[var(--status-info-bg)]',
    textClass: 'text-[var(--status-info-text)]',
    ringClass: 'ring-[var(--status-info-border)]',
  },
  delayed: {
    icon: '●',
    bgClass: 'bg-[var(--status-danger-bg)]',
    textClass: 'text-[var(--status-danger-text)]',
    ringClass: 'ring-[var(--status-danger-border)]',
  },
  loaded: {
    icon: '●',
    // Use same visual tone as 'in-transit' (blue) so "Carregado" appears
    // with the same color across the app as requested.
    bgClass: 'bg-[var(--status-info-bg)]',
    textClass: 'text-[var(--status-info-text)]',
    ringClass: 'ring-[var(--status-info-border)]',
  },
  customs: {
    icon: '●',
    bgClass: 'bg-[var(--status-warning-bg)]',
    textClass: 'text-[var(--status-warning-text)]',
    ringClass: 'ring-[var(--status-warning-border)]',
  },
  released: {
    icon: '●',
    bgClass: 'bg-[var(--status-success-bg)]',
    textClass: 'text-[var(--status-success-text)]',
    ringClass: 'ring-[var(--status-success-border)]',
  },
  delivered: {
    icon: '✓',
    bgClass: 'bg-[var(--status-success-bg)]',
    textClass: 'text-[var(--status-success-text)]',
    ringClass: 'ring-[var(--status-success-border)]',
  },
  partial: {
    icon: '◐',
    bgClass: 'bg-[var(--status-warning-bg)]',
    textClass: 'text-[var(--status-warning-text)]',
    ringClass: 'ring-[var(--status-warning-border)]',
  },
  pending: {
    icon: '○',
    bgClass: 'bg-[var(--bg-muted)]',
    textClass: 'text-[var(--text-tertiary)]',
    ringClass: 'ring-[var(--border-default)]',
  },
  unknown: {
    icon: '–',
    bgClass: 'bg-[var(--bg-muted)]',
    textClass: 'text-[var(--text-tertiary)]',
    ringClass: 'ring-[var(--border-default)]',
  },
}

export function StatusBadge(props: Props): JSX.Element {
  const config = createMemo(() => statusConfig[props.variant] ?? statusConfig.unknown)

  const bgClass = createMemo(() => (props.neutral ? 'bg-[var(--bg-muted)]' : config().bgClass))
  const textClass = createMemo(() => (props.neutral ? 'text-[var(--text-secondary)]' : config().textClass))
  const ringClass = createMemo(() => (props.neutral ? 'ring-[var(--border-default)]' : config().ringClass))
  const iconColorClass = createMemo(() => (props.neutral ? 'text-[var(--text-muted)]' : ''))

  return (
    <span
      class={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs-ui font-semibold leading-none tracking-wide whitespace-nowrap ring-1 ring-inset ${bgClass()} ${textClass()} ${ringClass()}`}
    >
      <span class={`text-[7px] ${iconColorClass()}`} aria-hidden="true">
        {config().icon}
      </span>
      <span>{props.label}</span>
    </span>
  )
}
