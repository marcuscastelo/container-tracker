import type { TrackingStatusCode } from '~/modules/tracking/features/status/application/projection/tracking.status.projection'
import type { StatusVariant } from '~/shared/ui/StatusBadge'

export const STATUS_COLOR = {
  UNKNOWN: 'slate-400',
  IN_PROGRESS: 'slate-500',
  LOADED: 'indigo-500',
  IN_TRANSIT: 'blue-500',
  ARRIVED_AT_POD: 'amber-500',
  DISCHARGED: 'orange-500',
  AVAILABLE_FOR_PICKUP: 'orange-500',
  DELIVERED: 'green-600',
  EMPTY_RETURNED: 'emerald-600',
} satisfies Readonly<Record<TrackingStatusCode, StatusVariant>>
