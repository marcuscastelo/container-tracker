import type { JSX } from 'solid-js'
import { createMemo } from 'solid-js'

export type StatusVariant =
  | 'slate-400'
  | 'slate-500'
  | 'indigo-500'
  | 'blue-500'
  | 'amber-500'
  | 'amber-600'
  | 'amber-700'
  | 'orange-500'
  | 'green-600'
  | 'emerald-600'
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
  'slate-400': {
    icon: '○',
    bgClass: 'bg-slate-50',
    textClass: 'text-slate-500',
  },
  'slate-500': {
    icon: '○',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-600',
  },
  'indigo-500': {
    icon: '●',
    bgClass: 'bg-indigo-50',
    textClass: 'text-indigo-700',
  },
  'blue-500': {
    icon: '●',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
  },
  'amber-500': {
    icon: '●',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
  },
  'amber-600': {
    icon: '●',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-800',
  },
  'amber-700': {
    icon: '●',
    bgClass: 'bg-amber-200',
    textClass: 'text-amber-900',
  },
  'orange-500': {
    icon: '●',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-700',
  },
  'green-600': {
    icon: '✓',
    bgClass: 'bg-green-50',
    textClass: 'text-green-700',
  },
  'emerald-600': {
    icon: '✓',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
  },
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
    bgClass: 'bg-indigo-50',
    textClass: 'text-indigo-700',
  },
  customs: {
    icon: '●',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
  },
  released: {
    icon: '●',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-700',
  },
  delivered: {
    icon: '✓',
    bgClass: 'bg-green-50',
    textClass: 'text-green-700',
  },
  partial: {
    icon: '◐',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-800',
  },
  pending: {
    icon: '○',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-600',
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
      class={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs-ui font-semibold leading-none tracking-wide whitespace-nowrap ring-1 ring-inset ring-current/15 ${bgClass()} ${textClass()}`}
    >
      <span class={`text-[7px] ${iconColorClass()}`} aria-hidden="true">
        {config().icon}
      </span>
      <span>{props.label}</span>
    </span>
  )
}
