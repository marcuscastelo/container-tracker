import { describe, expect, it } from 'vitest'
import {
  SyncAllProcessesSuccessResponseSchema,
  TrackingPredictionHistoryResponseSchema,
} from '~/shared/api-schemas/processes.schemas'

function expectObservedAtListIssue(result: {
  readonly success: boolean
  readonly error?: {
    readonly issues: readonly {
      readonly path: readonly PropertyKey[]
    }[]
  }
}): void {
  if (result.success) {
    throw new Error('Expected schema validation to fail')
  }

  const error = result.error
  if (!error) {
    throw new Error('Expected schema validation error details')
  }

  expect(error.issues.some((issue) => issue.path.includes('observed_at_list'))).toBe(true)
}

describe('TrackingPredictionHistoryResponseSchema', () => {
  it('rejects empty observed_at_list values', () => {
    const result = TrackingPredictionHistoryResponseSchema.safeParse({
      header: {
        tone: 'neutral',
        summary_kind: 'SINGLE_VERSION',
        current_version_id: 'version-1',
        previous_version_id: null,
        original_version_id: null,
        reason_kind: null,
      },
      versions: [
        {
          id: 'version-1',
          is_current: true,
          type: 'ARRIVAL',
          event_time: { kind: 'date', value: '2026-05-10', timezone: null },
          event_time_type: 'EXPECTED',
          vessel_name: null,
          voyage: null,
          version_state: 'INITIAL',
          explanatory_text_kind: null,
          transition_kind_from_previous_version: null,
          observed_at_count: 1,
          observed_at_list: [],
          first_observed_at: '2026-04-01T12:00:00.000Z',
          last_observed_at: '2026-04-01T12:00:00.000Z',
        },
      ],
    })

    expectObservedAtListIssue(result)
  })

  it('rejects mismatched observed_at_count values', () => {
    const result = TrackingPredictionHistoryResponseSchema.safeParse({
      header: {
        tone: 'neutral',
        summary_kind: 'SINGLE_VERSION',
        current_version_id: 'version-1',
        previous_version_id: null,
        original_version_id: null,
        reason_kind: null,
      },
      versions: [
        {
          id: 'version-1',
          is_current: true,
          type: 'ARRIVAL',
          event_time: { kind: 'date', value: '2026-05-10', timezone: null },
          event_time_type: 'EXPECTED',
          vessel_name: null,
          voyage: null,
          version_state: 'INITIAL',
          explanatory_text_kind: null,
          transition_kind_from_previous_version: null,
          observed_at_count: 2,
          observed_at_list: ['2026-04-01T12:00:00.000Z'],
          first_observed_at: '2026-04-01T12:00:00.000Z',
          last_observed_at: '2026-04-01T12:00:00.000Z',
        },
      ],
    })

    expectObservedAtListIssue(result)
  })
})

describe('SyncAllProcessesSuccessResponseSchema', () => {
  it('rejects mismatched requestedContainers counts', () => {
    const result = SyncAllProcessesSuccessResponseSchema.safeParse({
      ok: true,
      summary: {
        requestedProcesses: 1,
        requestedContainers: 3,
        enqueued: 1,
        skipped: 1,
        failed: 0,
      },
      enqueuedTargets: [
        {
          processId: 'process-1',
          processReference: 'REF-1',
          containerNumber: 'MSCU1234567',
          provider: 'msc',
          syncRequestId: 'sync-1',
        },
      ],
      skippedTargets: [
        {
          processId: 'process-1',
          processReference: 'REF-1',
          containerNumber: 'MRKU7654321',
          provider: 'maersk',
          reasonCode: 'DUPLICATE_OPEN_REQUEST',
          reasonMessage: 'Target already has an open sync request or was already included in this batch.',
        },
      ],
      failedTargets: [],
    })

    expect(result.success).toBe(false)
  })

  it('rejects summary counts that do not match target array lengths', () => {
    const result = SyncAllProcessesSuccessResponseSchema.safeParse({
      ok: true,
      summary: {
        requestedProcesses: 1,
        requestedContainers: 1,
        enqueued: 0,
        skipped: 0,
        failed: 1,
      },
      enqueuedTargets: [],
      skippedTargets: [],
      failedTargets: [],
    })

    expect(result.success).toBe(false)
  })
})
