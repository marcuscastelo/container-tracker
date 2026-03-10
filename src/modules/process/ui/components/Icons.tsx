import type { JSX } from 'solid-js'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'

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

export function AlertIcon(props: { readonly type: AlertDisplayVM['type'] }): JSX.Element {
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

  // Clock icon for delay / missing-eta
  const delayPath = () => 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
  // Route/arrows icon for transshipment/movement
  const movementPath = () => 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6'
  // Document icon for customs
  const customsPath = () =>
    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
  // Database icon for data/info
  const dataPath = () =>
    'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4'

  const iconPath = () => {
    switch (props.type) {
      case 'delay':
      case 'missing-eta':
        return delayPath()
      case 'transshipment':
        return movementPath()
      case 'customs':
        return customsPath()
      default:
        return dataPath()
    }
  }

  return (
    <svg
      class={`h-4 w-4 shrink-0 mt-0.5 ${colorClass()}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={iconPath()} />
    </svg>
  )
}
