import type { TrackingAlertType } from '~/modules/tracking/domain/model/trackingAlert'

export type TrackingOperationalAlertCategory = 'eta' | 'movement' | 'customs' | 'status' | 'data'

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
    case 'NO_MOVEMENT':
    case 'TRANSSHIPMENT':
      return 'movement'
    case 'CUSTOMS_HOLD':
      return 'customs'
    case 'PORT_CHANGE':
      return 'status'
    case 'DATA_INCONSISTENT':
      return 'data'
  }
}
