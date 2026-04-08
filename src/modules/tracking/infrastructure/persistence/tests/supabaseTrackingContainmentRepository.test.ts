import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TrackingValidationLifecycleRow } from '~/modules/tracking/infrastructure/persistence/tracking.row'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('~/shared/supabase/supabase', () => ({
  supabase: {
    from: mocks.from,
  },
}))

import { supabaseTrackingContainmentRepository } from '~/modules/tracking/infrastructure/persistence/supabaseTrackingContainmentRepository'

function createReadQuery(data: TrackingValidationLifecycleRow[]) {
  const query = {
    data,
    select: vi.fn(() => query),
    in: vi.fn(() => query),
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
    issue_code: overrides.issue_code ?? 'CONTAINER_REUSED_AFTER_COMPLETION',
    detector_id: overrides.detector_id ?? 'CONTAINER_REUSED_AFTER_COMPLETION',
    detector_version: overrides.detector_version ?? '1',
    affected_scope: overrides.affected_scope ?? 'TIMELINE',
    severity: overrides.severity ?? 'CRITICAL',
    transition_type: overrides.transition_type ?? 'activated',
    lifecycle_key: overrides.lifecycle_key ?? 'CONTAINER_REUSED_AFTER_COMPLETION:container-1',
    state_fingerprint: overrides.state_fingerprint ?? 'state-1',
    evidence_summary: overrides.evidence_summary ?? 'LOAD ACTUAL appeared after DELIVERED.',
    provider: overrides.provider ?? 'msc',
    snapshot_id: overrides.snapshot_id ?? 'snapshot-1',
    occurred_at: overrides.occurred_at ?? '2026-04-03T10:00:00.000Z',
    created_at: overrides.created_at ?? '2026-04-03T10:00:01.000Z',
  }
}

describe('supabaseTrackingContainmentRepository', () => {
  beforeEach(() => {
    mocks.from.mockReset()
  })

  it('maps legacy and dedicated issue codes to the containment read state', async () => {
    const query = createReadQuery([
      makeLifecycleRow({
        issue_code: 'POST_COMPLETION_TRACKING_CONTINUED',
        detector_id: 'POST_COMPLETION_TRACKING_CONTINUED',
        lifecycle_key: 'POST_COMPLETION_TRACKING_CONTINUED:container-1',
      }),
    ])
    mocks.from.mockReturnValue(query)

    const state = await supabaseTrackingContainmentRepository.findActiveByContainerId('container-1')

    expect(mocks.from).toHaveBeenCalledWith('tracking_validation_issue_transitions')
    expect(state).toEqual({
      active: true,
      reasonCode: 'CONTAINER_REUSED_AFTER_COMPLETION',
      activatedAt: '2026-04-03T10:00:00.000Z',
      provider: 'msc',
      snapshotId: 'snapshot-1',
      lifecycleKey: 'POST_COMPLETION_TRACKING_CONTINUED:container-1',
      stateFingerprint: 'state-1',
      evidenceSummary: 'LOAD ACTUAL appeared after DELIVERED.',
    })
  })

  it('treats containment as latched and ignores later resolved rows for the same lifecycle key', async () => {
    const query = createReadQuery([
      makeLifecycleRow({
        transition_type: 'resolved',
        occurred_at: '2026-04-04T10:00:00.000Z',
        created_at: '2026-04-04T10:00:01.000Z',
      }),
      makeLifecycleRow(),
    ])
    mocks.from.mockReturnValue(query)

    const state = await supabaseTrackingContainmentRepository.findActiveByContainerId('container-1')

    expect(state).toBeNull()
  })

  it('persists containment activation with the dedicated issue code and idempotent upsert', async () => {
    const containerLookupQuery = createContainerLookupQuery([
      { id: 'container-1', process_id: 'process-1' },
    ])
    const writeQuery = createWriteQuery()

    mocks.from.mockReturnValueOnce(containerLookupQuery).mockReturnValueOnce(writeQuery)

    await supabaseTrackingContainmentRepository.activate({
      containerId: 'container-1',
      provider: 'msc',
      snapshotId: 'snapshot-1',
      activatedAt: '2026-04-03T10:00:00.000Z',
      stateFingerprint: 'state-1',
      evidenceSummary: 'LOAD ACTUAL appeared after DELIVERED.',
    })

    expect(mocks.from).toHaveBeenNthCalledWith(1, 'containers')
    expect(mocks.from).toHaveBeenNthCalledWith(2, 'tracking_validation_issue_transitions')
    expect(writeQuery.upsert).toHaveBeenCalledWith(
      [
        {
          process_id: 'process-1',
          container_id: 'container-1',
          issue_code: 'CONTAINER_REUSED_AFTER_COMPLETION',
          detector_id: 'CONTAINER_REUSED_AFTER_COMPLETION',
          detector_version: '1',
          affected_scope: 'TIMELINE',
          severity: 'CRITICAL',
          transition_type: 'activated',
          lifecycle_key: 'CONTAINER_REUSED_AFTER_COMPLETION:container-1',
          state_fingerprint: 'state-1',
          evidence_summary: 'LOAD ACTUAL appeared after DELIVERED.',
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
