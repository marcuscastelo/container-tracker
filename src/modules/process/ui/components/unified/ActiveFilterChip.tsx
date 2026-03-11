import type { JSX } from 'solid-js'

export function ActiveFilterChip(props: {
  readonly label: string
  readonly ariaLabel: string
  readonly onRemove: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      class="inline-flex items-center gap-1 rounded-full border border-control-border bg-control-bg-hover px-2 py-0.5 text-sm-ui text-control-foreground transition-colors hover:border-control-border-hover hover:bg-control-selected-bg hover:text-control-foreground-strong"
      aria-label={props.ariaLabel}
      onClick={() => props.onRemove()}
    >
      <span>{props.label}</span>
      <span aria-hidden="true">×</span>
    </button>
  )
}
