import { Check, Circle, CircleDot, Minus } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { createMemo, Show } from 'solid-js'

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

type StatusIconKind = 'circle-filled' | 'circle-outline' | 'check' | 'partial' | 'dash'

type Props = {
  readonly variant: StatusVariant
  readonly label: string
  readonly neutral?: boolean
  readonly size?: 'default' | 'micro'
  readonly hideIcon?: boolean
}

const statusConfig: Record<
  StatusVariant,
  { icon: StatusIconKind; bgClass: string; textClass: string }
> = {
  'slate-400': {
    icon: 'circle-outline',
    bgClass: 'bg-slate-50',
    textClass: 'text-slate-500',
  },
  'slate-500': {
    icon: 'circle-outline',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-600',
  },
  'indigo-500': {
    icon: 'circle-filled',
    bgClass: 'bg-indigo-50',
    textClass: 'text-indigo-700',
  },
  'blue-500': {
    icon: 'circle-filled',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
  },
  'amber-500': {
    icon: 'circle-filled',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
  },
  'amber-600': {
    icon: 'circle-filled',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-800',
  },
  'amber-700': {
    icon: 'circle-filled',
    bgClass: 'bg-amber-200',
    textClass: 'text-amber-900',
  },
  'orange-500': {
    icon: 'circle-filled',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-700',
  },
  'green-600': {
    icon: 'check',
    bgClass: 'bg-green-50',
    textClass: 'text-green-700',
  },
  'emerald-600': {
    icon: 'check',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
  },
  'in-transit': {
    icon: 'circle-filled',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
  },
  delayed: {
    icon: 'circle-filled',
    bgClass: 'bg-red-50',
    textClass: 'text-red-700',
  },
  loaded: {
    icon: 'circle-filled',
    bgClass: 'bg-indigo-50',
    textClass: 'text-indigo-700',
  },
  customs: {
    icon: 'circle-filled',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
  },
  released: {
    icon: 'circle-filled',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-700',
  },
  delivered: {
    icon: 'check',
    bgClass: 'bg-green-50',
    textClass: 'text-green-700',
  },
  partial: {
    icon: 'partial',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-800',
  },
  pending: {
    icon: 'circle-outline',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-600',
  },
  unknown: {
    icon: 'dash',
    bgClass: 'bg-slate-50',
    textClass: 'text-slate-500',
  },
}

function StatusIcon(props: {
  readonly kind: StatusIconKind
  readonly class?: string
}): JSX.Element {
  const cls = () => props.class ?? ''
  return (
    <>
      <Show when={props.kind === 'circle-filled'}>
        <Circle class={`${cls()} fill-current`} />
      </Show>
      <Show when={props.kind === 'circle-outline'}>
        <Circle class={cls()} />
      </Show>
      <Show when={props.kind === 'check'}>
        <Check class={cls()} />
      </Show>
      <Show when={props.kind === 'partial'}>
        <CircleDot class={cls()} />
      </Show>
      <Show when={props.kind === 'dash'}>
        <Minus class={cls()} />
      </Show>
    </>
  )
}

export function StatusBadge(props: Props): JSX.Element {
  const config = createMemo(() => statusConfig[props.variant] ?? statusConfig.unknown)

  const bgClass = createMemo(() => (props.neutral ? 'bg-slate-50' : config().bgClass))
  const textClass = createMemo(() => (props.neutral ? 'text-slate-600' : config().textClass))
  const iconColorClass = createMemo(() => (props.neutral ? 'text-slate-400' : ''))
  const wrapperClass = createMemo(() => {
    if (props.size === 'micro') {
      return 'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-micro font-semibold leading-none whitespace-nowrap ring-1 ring-inset ring-current/15'
    }

    return 'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs-ui font-semibold leading-none tracking-wide whitespace-nowrap ring-1 ring-inset ring-current/15'
  })
  const iconSize = createMemo(() => (props.size === 'micro' ? 'w-2.5 h-2.5' : 'w-3 h-3'))
  const labelClass = createMemo(() => (props.size === 'micro' ? 'truncate max-w-[11rem]' : ''))

  return (
    <span class={`${wrapperClass()} ${bgClass()} ${textClass()}`}>
      <Show when={props.hideIcon !== true}>
        <span class={`inline-flex items-center ${iconColorClass()}`} aria-hidden="true">
          <StatusIcon kind={config().icon} class={iconSize()} />
        </span>
      </Show>
      <span class={labelClass()}>{props.label}</span>
    </span>
  )
}
