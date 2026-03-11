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
    iconBg: 'bg-control-bg-hover',
    iconText: 'text-control-foreground',
    labelClass: 'text-text-muted',
    valueClass: 'text-foreground',
  },
  warning: {
    iconBg: 'bg-tone-warning-bg',
    iconText: 'text-tone-warning-fg',
    labelClass: 'text-tone-warning-fg',
    valueClass: 'text-tone-warning-fg',
  },
  info: {
    iconBg: 'bg-tone-info-bg',
    iconText: 'text-tone-info-fg',
    labelClass: 'text-tone-info-fg',
    valueClass: 'text-tone-info-fg',
  },
  danger: {
    iconBg: 'bg-tone-danger-bg',
    iconText: 'text-tone-danger-fg',
    labelClass: 'text-tone-danger-fg',
    valueClass: 'text-tone-danger-fg',
  },
  success: {
    iconBg: 'bg-tone-success-bg',
    iconText: 'text-tone-success-fg',
    labelClass: 'text-tone-success-fg',
    valueClass: 'text-tone-success-fg',
  },
}

export function MetricCard(props: Props): JSX.Element {
  const styles = () => variantStyles[props.variant ?? 'default']

  return (
    <div class="flex items-center gap-3 rounded border border-border bg-surface px-3 py-2.5">
      <div
        class={`flex h-8 w-8 shrink-0 items-center justify-center rounded ${styles().iconBg} ${styles().iconText}`}
      >
        {props.icon}
      </div>
      <div class="flex flex-col gap-0">
        <span class={`text-xl-ui font-bold leading-tight tabular-nums ${styles().valueClass}`}>
          {props.value}
        </span>
        <span class={`text-xs-ui font-medium leading-tight ${styles().labelClass}`}>
          {props.label}
        </span>
        <Show when={props.subtitle}>
          {(subtitle) => <span class="text-xs-ui mt-0.5 text-text-muted">{subtitle()}</span>}
        </Show>
      </div>
    </div>
  )
}
