import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TrackingValidationLifecycleTransition } from '~/modules/tracking/features/validation/domain/model/trackingValidationLifecycle'
import type { TrackingValidationLifecycleRow } from '~/modules/tracking/infrastructure/persistence/tracking.row'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('~/shared/supabase/supabase', () => ({
  supabase: {
    from: mocks.from,
  },
}))

import { supabaseTrackingValidationLifecycleRepository } from '~/modules/tracking/infrastructure/persistence/supabaseTrackingValidationLifecycleRepository'

function createReadQuery(data: TrackingValidationLifecycleRow[]) {
  const query = {
    data,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
  }

  return query
}

function createContainerLookupQuery(data: readonly { id: string; process_id: string }[]) {
  const query = {
    data,
    select: vi.fn(() => query),
    in: vi.fn(() => query),
  }

  return query
}

function createWriteQuery() {
  const query = {
    data: [{ id: 'transition-row-1' }],
    upsert: vi.fn(() => query),
    select: vi.fn(() => query),
  }

  return query
}

function makeLifecycleRow(
  overrides: Partial<TrackingValidationLifecycleRow> = {},
): TrackingValidationLifecycleRow {
  return {
    id: overrides.id ?? 'transition-row-1',
    process_id: overrides.process_id ?? 'process-1',
    container_id: overrides.container_id ?? 'container-1',
    issue_code: overrides.issue_code ?? 'POST_COMPLETION_TRACKING_CONTINUED',
    detector_id: overrides.detector_id ?? 'POST_COMPLETION_TRACKING_CONTINUED',
    detector_version: overrides.detector_version ?? '1',
    affected_scope: overrides.affected_scope ?? 'TIMELINE',
    severity: overrides.severity ?? 'CRITICAL',
    transition_type: overrides.transition_type ?? 'activated',
    lifecycle_key: overrides.lifecycle_key ?? 'POST_COMPLETION_TRACKING_CONTINUED:container-1',
    state_fingerprint: overrides.state_fingerprint ?? 'state-1',
    evidence_summary: overrides.evidence_summary ?? 'Load ACTUAL appeared after EMPTY_RETURNED.',
    provider: overrides.provider ?? 'msc',
    snapshot_id: overrides.snapshot_id ?? 'snapshot-1',
    occurred_at: overrides.occurred_at ?? '2026-04-03T10:00:00.000Z',
    created_at: overrides.created_at ?? '2026-04-03T10:00:01.000Z',
  }
}

function makeTransition(
  overrides: Partial<TrackingValidationLifecycleTransition> = {},
): TrackingValidationLifecycleTransition {
  return {
    containerId: overrides.containerId ?? 'container-1',
    issueCode: overrides.issueCode ?? 'POST_COMPLETION_TRACKING_CONTINUED',
    detectorId: overrides.detectorId ?? 'POST_COMPLETION_TRACKING_CONTINUED',
    detectorVersion: overrides.detectorVersion ?? '1',
    affectedScope: overrides.affectedScope ?? 'TIMELINE',
    severity: overrides.severity ?? 'CRITICAL',
    transitionType: overrides.transitionType ?? 'activated',
    lifecycleKey: overrides.lifecycleKey ?? 'POST_COMPLETION_TRACKING_CONTINUED:container-1',
    stateFingerprint: overrides.stateFingerprint ?? 'state-1',
    evidenceSummary: overrides.evidenceSummary ?? 'Load ACTUAL appeared after EMPTY_RETURNED.',
    provider: overrides.provider ?? 'msc',
    snapshotId: overrides.snapshotId ?? 'snapshot-1',
    occurredAt: overrides.occurredAt ?? '2026-04-03T10:00:00.000Z',
  }
}

describe('supabaseTrackingValidationLifecycleRepository', () => {
  beforeEach(() => {
    mocks.from.mockReset()
  })

  it('requests deterministic ordering with created_at as the lifecycle tie-breaker', async () => {
    const query = createReadQuery([makeLifecycleRow()])
    mocks.from.mockReturnValue(query)

    const activeStates =
      await supabaseTrackingValidationLifecycleRepository.findActiveStatesByContainerId(
        'container-1',
      )

    expect(mocks.from).toHaveBeenCalledWith('tracking_validation_issue_transitions')
    expect(query.order.mock.calls).toEqual([
      ['occurred_at', { ascending: false }],
      ['created_at', { ascending: false }],
      ['id', { ascending: false }],
    ])
    expect(activeStates).toHaveLength(1)
    expect(activeStates[0]).toMatchObject({
      lifecycleKey: 'POST_COMPLETION_TRACKING_CONTINUED:container-1',
      stateFingerprint: 'state-1',
    })
  })

  it('uses idempotent upsert semantics for deduplicated lifecycle transitions', async () => {
    const containerLookupQuery = createContainerLookupQuery([
      { id: 'container-1', process_id: 'process-1' },
    ])
    const writeQuery = createWriteQuery()

    mocks.from.mockReturnValueOnce(containerLookupQuery).mockReturnValueOnce(writeQuery)

    await supabaseTrackingValidationLifecycleRepository.insertMany([makeTransition()])

    expect(mocks.from).toHaveBeenNthCalledWith(1, 'containers')
    expect(mocks.from).toHaveBeenNthCalledWith(2, 'tracking_validation_issue_transitions')
    expect(writeQuery.upsert).toHaveBeenCalledWith(
      [
        {
          process_id: 'process-1',
          container_id: 'container-1',
          issue_code: 'POST_COMPLETION_TRACKING_CONTINUED',
          detector_id: 'POST_COMPLETION_TRACKING_CONTINUED',
          detector_version: '1',
          affected_scope: 'TIMELINE',
          severity: 'CRITICAL',
          transition_type: 'activated',
          lifecycle_key: 'POST_COMPLETION_TRACKING_CONTINUED:container-1',
          state_fingerprint: 'state-1',
          evidence_summary: 'Load ACTUAL appeared after EMPTY_RETURNED.',
          provider: 'msc',
          snapshot_id: 'snapshot-1',
          occurred_at: '2026-04-03T10:00:00.000Z',
        },
      ],
      {
        onConflict: 'container_id,lifecycle_key,transition_type,state_fingerprint,snapshot_id',
        ignoreDuplicates: true,
      },
    )
    expect(writeQuery.select).toHaveBeenCalledWith('id')
  })
})
