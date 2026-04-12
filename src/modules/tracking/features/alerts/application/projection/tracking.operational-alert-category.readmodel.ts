import type { TrackingAlertType } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'

export type TrackingOperationalAlertCategory = 'eta' | 'movement' | 'customs' | 'data'

/**
 * Maps canonical tracking alert types to dashboard operational buckets.
 * This keeps alert semantics owned by Tracking BC while letting capabilities aggregate safely.
 */
export function toTrackingOperationalAlertCategory(
  type: TrackingAlertType,
): TrackingOperationalAlertCategory {
  switch (type) {
    case 'ETA_MISSING':
    case 'ETA_PASSED':
      return 'eta'
    case 'TRANSSHIPMENT':
    case 'PLANNED_TRANSSHIPMENT':
    case 'PORT_CHANGE':
      return 'movement'
    case 'CUSTOMS_HOLD':
      return 'customs'
    case 'DATA_INCONSISTENT':
      return 'data'
  }
}
