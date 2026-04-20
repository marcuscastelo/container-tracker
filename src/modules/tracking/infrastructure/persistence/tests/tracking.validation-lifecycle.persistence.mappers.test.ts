import { describe, expect, it } from 'vitest'
import { trackingValidationLifecycleTransitionToInsertRow } from '~/modules/tracking/infrastructure/persistence/tracking.validation-lifecycle.persistence.mappers'

describe('tracking validation lifecycle persistence mappers', () => {
  it('persists only the lightweight operational transition contract', () => {
    const row = trackingValidationLifecycleTransitionToInsertRow({
      processId: 'process-1',
      transition: {
        containerId: 'container-1',
        transitionType: 'activated',
        lifecycleKey: 'detector-1:container-1',
        issueCode: 'ISSUE_1',
        detectorId: 'detector-1',
        detectorVersion: '1',
        affectedScope: 'TIMELINE',
        severity: 'ADVISORY',
        stateFingerprint: 'state-a',
        evidenceSummary: 'Evidence A',
        provider: 'maersk',
        snapshotId: 'snapshot-1',
        occurredAt: '2026-04-03T10:00:00.000Z',
      },
    })

    expect(row).toEqual({
      process_id: 'process-1',
      container_id: 'container-1',
      issue_code: 'ISSUE_1',
      detector_id: 'detector-1',
      detector_version: '1',
      affected_scope: 'TIMELINE',
      severity: 'ADVISORY',
      transition_type: 'activated',
      lifecycle_key: 'detector-1:container-1',
      state_fingerprint: 'state-a',
      evidence_summary: 'Evidence A',
      provider: 'maersk',
      snapshot_id: 'snapshot-1',
      occurred_at: '2026-04-03T10:00:00.000Z',
    })
    expect(Object.keys(row).sort()).toEqual([
      'affected_scope',
      'container_id',
      'detector_id',
      'detector_version',
      'evidence_summary',
      'issue_code',
      'lifecycle_key',
      'occurred_at',
      'process_id',
      'provider',
      'severity',
      'snapshot_id',
      'state_fingerprint',
      'transition_type',
    ])
    expect('payload' in row).toBe(false)
    expect('findings' in row).toBe(false)
  })
})
