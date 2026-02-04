import type { JSX } from 'solid-js'

type Variant = 'default' | 'warning' | 'success'

type Props = {
  readonly icon: JSX.Element
  readonly label: string
  readonly value: number | string
  readonly variant?: Variant
}

const variantStyles: Record<Variant, { labelClass: string; valueClass: string }> = {
  default: {
    labelClass: 'text-slate-600',
    valueClass: 'text-slate-900',
  },
  warning: {
    labelClass: 'text-red-600',
    valueClass: 'text-red-700',
  },
  success: {
    labelClass: 'text-emerald-600',
    valueClass: 'text-emerald-700',
  },
}

export function MetricCard(props: Props): JSX.Element {
  const styles = () => variantStyles[props.variant ?? 'default']

  return (
    <div class="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-5 py-4">
      <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        {props.icon}
      </div>
      <div class="flex flex-col">
        <span class={`text-sm font-medium ${styles().labelClass}`}>{props.label}</span>
        <span class={`text-2xl font-semibold ${styles().valueClass}`}>{props.value}</span>
      </div>
    </div>
  )
}
