import type { JSX } from 'solid-js'

export function ActiveFilterChip(props: {
  readonly label: string
  readonly ariaLabel: string
  readonly onRemove: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[12px] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-200"
      aria-label={props.ariaLabel}
      onClick={() => props.onRemove()}
    >
      <span>{props.label}</span>
      <span aria-hidden="true">×</span>
    </button>
  )
}
