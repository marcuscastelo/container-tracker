import type { JSX } from 'solid-js'

export function ChevronDownIcon(): JSX.Element {
  return (
    <svg
      class="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  )
}
