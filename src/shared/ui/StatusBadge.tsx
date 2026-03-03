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
  const config = () => statusConfig[props.variant] ?? statusConfig.unknown

  return (
    <span
      class={`inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold leading-none tracking-wide ${config().bgClass} ${config().textClass}`}
    >
      <span class="text-[7px]" aria-hidden="true">
        {config().icon}
      </span>
      <span>{props.label}</span>
    </span>
  )
}
