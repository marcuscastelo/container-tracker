import type { JSX } from 'solid-js'

export type StatusVariant =
  | 'in-transit'
  | 'delayed'
  | 'loaded'
  | 'customs'
  | 'released'
  | 'delivered'
  | 'pending'
  | 'unknown'

type Props = {
  readonly variant: StatusVariant
  readonly label: string
}

const statusConfig: Record<StatusVariant, { icon: string; bgClass: string; textClass: string }> = {
  'in-transit': {
    icon: '🚢',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-800',
  },
  delayed: {
    icon: '⚠',
    bgClass: 'bg-red-100',
    textClass: 'text-red-800',
  },
  loaded: {
    icon: '📦',
    bgClass: 'bg-emerald-100',
    textClass: 'text-emerald-800',
  },
  customs: {
    icon: '📋',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-800',
  },
  released: {
    icon: '✓',
    bgClass: 'bg-green-100',
    textClass: 'text-green-800',
  },
  delivered: {
    icon: '✓',
    bgClass: 'bg-green-100',
    textClass: 'text-green-800',
  },
  pending: {
    icon: '○',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-600',
  },
  unknown: {
    icon: '?',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-600',
  },
}

export function StatusBadge(props: Props): JSX.Element {
  const config = () => statusConfig[props.variant] ?? statusConfig.unknown

  return (
    <span
      class={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium ${config().bgClass} ${config().textClass}`}
    >
      <span aria-hidden="true">{config().icon}</span>
      <span>{props.label}</span>
    </span>
  )
}
