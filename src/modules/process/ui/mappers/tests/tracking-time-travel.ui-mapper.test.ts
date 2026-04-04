import { describe, expect, it } from 'vitest'
import type { TrackingTimeTravelResponseDto } from '~/modules/process/ui/api/tracking-time-travel.api'
import { toTrackingTimeTravelVm } from '~/modules/process/ui/mappers/tracking-time-travel.ui-mapper'
import { temporalDtoFromCanonical } from '~/shared/time/tests/helpers'

function makeTimeTravelResponse(): TrackingTimeTravelResponseDto {
  return {
    container_id: 'container-1',
    container_number: 'MNBU3094033',
    reference_now: '2026-04-04T12:00:00.000Z',
    selected_snapshot_id: 'snapshot-2',
    sync_count: 1,
    syncs: [
      {
        snapshot_id: 'snapshot-2',
        fetched_at: '2026-04-04T11:00:00.000Z',
        position: 1,
        timeline: [],
        status: 'IN_TRANSIT',
        alerts: [],
        eta: {
          event_time: temporalDtoFromCanonical('2026-04-10T10:00:00.000Z'),
          event_time_type: 'EXPECTED',
          state: 'ACTIVE_EXPECTED',
          type: 'ARRIVAL',
          location_code: 'BRSSZ',
          location_display: 'Santos',
        },
        operational: {
          status: 'IN_TRANSIT',
          eta: null,
          current_context: {
            location_code: 'MAPTM',
            location_display: 'Tangier Med',
            vessel_name: 'MAERSK SEVILLE',
            voyage: '123W',
            vessel_visible: true,
          },
          next_location: null,
          transshipment: {
            has_transshipment: false,
            count: 0,
            ports: [],
          },
        },
        tracking_validation: {
          has_issues: true,
          highest_severity: 'danger',
          finding_count: 2,
        },
        diff_from_previous: {
          kind: 'initial',
        },
        debug_available: true,
      },
    ],
  }
}

describe('tracking-time-travel.ui-mapper', () => {
  it('maps checkpoint tracking validation without re-deriving semantics in the UI', () => {
    const result = toTrackingTimeTravelVm(makeTimeTravelResponse(), 'pt-BR')

    expect(result.selectedSnapshotId).toBe('snapshot-2')
    expect(result.syncs[0]?.trackingValidation).toEqual({
      hasIssues: true,
      highestSeverity: 'danger',
      findingCount: 2,
    })
    expect(Object.keys(result.syncs[0]?.trackingValidation ?? {}).sort()).toEqual([
      'findingCount',
      'hasIssues',
      'highestSeverity',
    ])
  })
})
