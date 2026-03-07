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

const statusConfig: Record<StatusVariant, { icon: string; bgClass: string; textClass: string }> = {
  'in-transit': {
    icon: '●',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
  },
  delayed: {
    icon: '●',
    bgClass: 'bg-red-50',
    textClass: 'text-red-700',
  },
  loaded: {
    icon: '●',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
  },
  customs: {
    icon: '●',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
  },
  released: {
    icon: '●',
    bgClass: 'bg-green-50',
    textClass: 'text-green-700',
  },
  delivered: {
    icon: '✓',
    bgClass: 'bg-green-50',
    textClass: 'text-green-700',
  },
  partial: {
    icon: '◐',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
  },
  pending: {
    icon: '○',
    bgClass: 'bg-slate-50',
    textClass: 'text-slate-500',
  },
  unknown: {
    icon: '–',
    bgClass: 'bg-slate-50',
    textClass: 'text-slate-500',
  },
}

export function StatusBadge(props: Props): JSX.Element {
  const config = createMemo(() => statusConfig[props.variant] ?? statusConfig.unknown)

  const bgClass = createMemo(() => (props.neutral ? 'bg-slate-50' : config().bgClass))
  const textClass = createMemo(() => (props.neutral ? 'text-slate-600' : config().textClass))
  const iconColorClass = createMemo(() => (props.neutral ? 'text-slate-400' : ''))

  return (
    <span
      class={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs-ui font-semibold leading-none tracking-wide ring-1 ring-inset ring-current/15 ${bgClass()} ${textClass()}`}
    >
      <span class={`text-micro ${iconColorClass()}`} aria-hidden="true">
        {config().icon}
      </span>
      <span>{props.label}</span>
    </span>
  )
}
