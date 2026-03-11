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

const statusConfig: Record<StatusVariant, { icon: StatusIconKind }> = {
  'slate-400': { icon: 'circle-outline' },
  'slate-500': { icon: 'circle-outline' },
  'indigo-500': { icon: 'circle-filled' },
  'blue-500': { icon: 'circle-filled' },
  'amber-500': { icon: 'circle-filled' },
  'amber-600': { icon: 'circle-filled' },
  'amber-700': { icon: 'circle-filled' },
  'orange-500': { icon: 'circle-filled' },
  'green-600': { icon: 'check' },
  'emerald-600': { icon: 'check' },
  'in-transit': { icon: 'circle-filled' },
  delayed: { icon: 'circle-filled' },
  loaded: { icon: 'circle-filled' },
  customs: { icon: 'circle-filled' },
  released: { icon: 'circle-filled' },
  delivered: { icon: 'check' },
  partial: { icon: 'partial' },
  pending: { icon: 'circle-outline' },
  unknown: { icon: 'dash' },
}

function toStatusColorClasses(variant: StatusVariant): string {
  if (variant === 'blue-500' || variant === 'indigo-500' || variant === 'in-transit') {
    return 'border-[color:var(--color-status-in-transit-border)] bg-[color:var(--color-status-in-transit-bg)] text-[color:var(--color-status-in-transit-fg)]'
  }

  // VariantGroups
  const dischargedVariants: StatusVariant[] = [
    'orange-500',
    'amber-500',
    'amber-600',
    'amber-700',
    'customs',
    'loaded',
    'partial',
  ]
  const clearedVariants: StatusVariant[] = ['green-600', 'emerald-600', 'delivered', 'released']

  if (dischargedVariants.includes(variant)) {
    return 'border-[color:var(--color-status-discharged-border)] bg-[color:var(--color-status-discharged-bg)] text-[color:var(--color-status-discharged-fg)]'
  }

  if (clearedVariants.includes(variant)) {
    return 'border-[color:var(--color-status-cleared-border)] bg-[color:var(--color-status-cleared-bg)] text-[color:var(--color-status-cleared-fg)]'
  }

  if (variant === 'delayed') {
    return 'border-[color:var(--color-status-delayed-border)] bg-[color:var(--color-status-delayed-bg)] text-[color:var(--color-status-delayed-fg)]'
  }

  return 'border-slate-200 bg-slate-100 text-slate-600'
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

  const colorClass = createMemo(() =>
    props.neutral
      ? 'border-slate-200 bg-slate-100 text-slate-600'
      : toStatusColorClasses(props.variant),
  )
  const iconColorClass = createMemo(() => (props.neutral ? 'text-slate-400' : ''))
  const wrapperClass = createMemo(() => {
    if (props.size === 'micro') {
      return 'dashboard-status-chip text-micro'
    }

    return 'dashboard-status-chip text-xs-ui'
  })
  const iconSize = createMemo(() => (props.size === 'micro' ? 'w-2.5 h-2.5' : 'w-3 h-3'))
  const labelClass = createMemo(() => (props.size === 'micro' ? 'truncate max-w-[11rem]' : ''))

  return (
    <span class={`${wrapperClass()} ${colorClass()}`}>
      <Show when={props.hideIcon !== true}>
        <span class={`inline-flex items-center ${iconColorClass()}`} aria-hidden="true">
          <StatusIcon kind={config().icon} class={iconSize()} />
        </span>
      </Show>
      <span class={labelClass()}>{props.label}</span>
    </span>
  )
}
