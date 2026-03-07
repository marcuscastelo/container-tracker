import { type JSX, Show } from 'solid-js'

type Variant = 'default' | 'warning' | 'info' | 'danger' | 'success'

type Props = {
  readonly icon: JSX.Element
  readonly label: string
  readonly value: number | string
  readonly variant?: Variant
  readonly subtitle?: string
}

const variantStyles: Record<
  Variant,
  { iconBg: string; iconText: string; labelClass: string; valueClass: string }
> = {
  default: {
    iconBg: 'bg-slate-50',
    iconText: 'text-slate-500',
    labelClass: 'text-slate-500',
    valueClass: 'text-slate-900',
  },
  warning: {
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-500',
    labelClass: 'text-amber-600',
    valueClass: 'text-amber-700',
  },
  info: {
    iconBg: 'bg-blue-50',
    iconText: 'text-blue-500',
    labelClass: 'text-blue-600',
    valueClass: 'text-blue-700',
  },
  danger: {
    iconBg: 'bg-red-50',
    iconText: 'text-red-500',
    labelClass: 'text-red-600',
    valueClass: 'text-red-700',
  },
  success: {
    iconBg: 'bg-emerald-50',
    iconText: 'text-emerald-500',
    labelClass: 'text-emerald-600',
    valueClass: 'text-emerald-700',
  },
}

export function MetricCard(props: Props): JSX.Element {
  const styles = () => variantStyles[props.variant ?? 'default']

  return (
    <div class="flex items-center gap-3 rounded border border-slate-200 bg-white px-3 py-2.5">
      <div
        class={`flex h-8 w-8 shrink-0 items-center justify-center rounded ${styles().iconBg} ${styles().iconText}`}
      >
        {props.icon}
      </div>
      <div class="flex flex-col gap-0">
        <span class={`text-[22px] font-bold leading-tight tabular-nums ${styles().valueClass}`}>
          {props.value}
        </span>
        <span class={`text-[11px] font-medium leading-tight ${styles().labelClass}`}>
          {props.label}
        </span>
        <Show when={props.subtitle}>
          {(subtitle) => <span class="text-[11px] mt-0.5 text-slate-400">{subtitle()}</span>}
        </Show>
      </div>
    </div>
  )
}
