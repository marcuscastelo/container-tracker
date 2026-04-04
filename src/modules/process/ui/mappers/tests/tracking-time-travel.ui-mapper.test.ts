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
          active_issues: [
            {
              code: 'CONFLICTING_CRITICAL_ACTUALS',
              severity: 'danger',
              reason_key: 'tracking.validation.conflictingCriticalActuals',
              affected_area: 'series',
              affected_location: 'BRSSZ',
              affected_block_label_key: null,
            },
            {
              code: 'POST_COMPLETION_TRACKING_CONTINUED',
              severity: 'danger',
              reason_key: 'tracking.validation.postCompletionTrackingContinued',
              affected_area: 'timeline',
              affected_location: null,
              affected_block_label_key: null,
            },
          ],
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
      activeIssues: [
        {
          code: 'CONFLICTING_CRITICAL_ACTUALS',
          severity: 'danger',
          reasonKey: 'tracking.validation.conflictingCriticalActuals',
          affectedArea: 'series',
          affectedLocation: 'BRSSZ',
          affectedBlockLabelKey: null,
        },
        {
          code: 'POST_COMPLETION_TRACKING_CONTINUED',
          severity: 'danger',
          reasonKey: 'tracking.validation.postCompletionTrackingContinued',
          affectedArea: 'timeline',
          affectedLocation: null,
          affectedBlockLabelKey: null,
        },
      ],
    })
    expect(Object.keys(result.syncs[0]?.trackingValidation ?? {}).sort()).toEqual([
      'activeIssues',
      'findingCount',
      'hasIssues',
      'highestSeverity',
    ])
  })

  it('maps the new advisory validation reasons through historical checkpoints unchanged', () => {
    const response = makeTimeTravelResponse()
    const checkpoint = response.syncs[0]

    if (!checkpoint) {
      throw new Error('Expected time-travel sync fixture')
    }

    checkpoint.tracking_validation = {
      has_issues: true,
      highest_severity: 'warning',
      finding_count: 2,
      active_issues: [
        {
          code: 'EXPECTED_PLAN_NOT_RECONCILABLE',
          severity: 'warning',
          reason_key: 'tracking.validation.expectedPlanNotReconcilable',
          affected_area: 'series',
          affected_location: 'BRSSZ',
          affected_block_label_key: null,
        },
        {
          code: 'MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT',
          severity: 'warning',
          reason_key: 'tracking.validation.missingCriticalMilestoneWithContradictoryContext',
          affected_area: 'timeline',
          affected_location: 'BRSSZ',
          affected_block_label_key: null,
        },
      ],
    }

    const result = toTrackingTimeTravelVm(response, 'pt-BR')

    expect(result.syncs[0]?.trackingValidation).toEqual({
      hasIssues: true,
      highestSeverity: 'warning',
      findingCount: 2,
      activeIssues: [
        {
          code: 'EXPECTED_PLAN_NOT_RECONCILABLE',
          severity: 'warning',
          reasonKey: 'tracking.validation.expectedPlanNotReconcilable',
          affectedArea: 'series',
          affectedLocation: 'BRSSZ',
          affectedBlockLabelKey: null,
        },
        {
          code: 'MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT',
          severity: 'warning',
          reasonKey: 'tracking.validation.missingCriticalMilestoneWithContradictoryContext',
          affectedArea: 'timeline',
          affectedLocation: 'BRSSZ',
          affectedBlockLabelKey: null,
        },
      ],
    })
  })
})
