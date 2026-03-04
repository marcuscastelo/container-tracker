import type { JSX } from 'solid-js'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'

/** Resolves an SVG path for a canonical tracking event type.
 *  Returns undefined for types without a dedicated icon. */
export function timelineEventIconPath(eventType: string): string | undefined {
  switch (eventType) {
    case 'GATE_IN':
    case 'GATE_OUT':
      // Warehouse / gate icon
      return 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4'
    case 'LOAD':
      // Container / cube icon
      return 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'
    case 'DEPARTURE':
      // Ship icon
      return 'M3 17h1l2-5h12l2 5h1M5 21h14M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M7 12h10'
    case 'ARRIVAL':
      // Anchor icon
      return 'M12 8a2 2 0 100-4 2 2 0 000 4zm0 0v12m-4-4l4 4 4-4M6 12a6 6 0 0112 0'
    case 'DISCHARGE':
      // Crane/unload icon
      return 'M9 17V7m0 10h6M9 17H5l-2-4M15 7v10m0-10h4l2-4M12 3v4'
    case 'DELIVERY':
      // Truck icon
      return 'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10m10 0H3m10 0a2 2 0 104 0m-4 0a2 2 0 114 0M3 16a2 2 0 104 0m-4 0a2 2 0 114 0m14-4v4h-2m0 0a2 2 0 10-4 0m4 0a2 2 0 11-4 0M17 8h2l3 4'
    case 'EMPTY_RETURN':
      // Return arrow icon
      return 'M3 10h10a5 5 0 010 10H9M3 10l4-4M3 10l4 4'
    case 'CUSTOMS_HOLD':
    case 'CUSTOMS_RELEASE':
      // Shield icon
      return 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
    default:
      return undefined
  }
}

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
