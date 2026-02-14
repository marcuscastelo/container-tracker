import type { JSX } from 'solid-js'
import type { AlertDisplay } from '~/modules/tracking/application/projection/tracking.alert.presenter'

export function ChevronLeftIcon(): JSX.Element {
  return (
    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
    </svg>
  )
}

export function ArrowIcon(): JSX.Element {
  return (
    <svg
      class="h-4 w-4 text-slate-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M17 8l4 4m0 0l-4 4m4-4H3"
      />
    </svg>
  )
}

export function AlertIcon(props: { readonly type: AlertDisplay['type'] }): JSX.Element {
  const colorClass = () => {
    switch (props.type) {
      case 'delay':
        return 'text-red-500'
      case 'customs':
        return 'text-amber-500'
      case 'missing-eta':
        return 'text-amber-500'
      case 'transshipment':
        return 'text-orange-500'
      default:
        return 'text-blue-500'
    }
  }

  return (
    <svg
      class={`h-5 w-5 ${colorClass()}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  )
}
