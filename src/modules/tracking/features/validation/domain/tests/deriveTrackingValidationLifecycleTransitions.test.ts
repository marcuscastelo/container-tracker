import { describe, expect, it } from 'vitest'
import type { TrackingValidationFinding } from '~/modules/tracking/features/validation/domain/model/trackingValidationFinding'
import type {
  TrackingValidationLifecycleState,
  TrackingValidationLifecycleTransitionContext,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationLifecycle'
import { deriveTrackingValidationLifecycleTransitions } from '~/modules/tracking/features/validation/domain/services/deriveTrackingValidationLifecycleTransitions'

function createFinding(
  overrides: Partial<TrackingValidationFinding> = {},
): TrackingValidationFinding {
  return {
    detectorId: overrides.detectorId ?? 'DETECTOR_1',
    detectorVersion: overrides.detectorVersion ?? '1',
    code: overrides.code ?? 'DETECTOR_1',
    lifecycleKey: overrides.lifecycleKey ?? 'DETECTOR_1:container-1',
    stateFingerprint: overrides.stateFingerprint ?? 'state-a',
    severity: overrides.severity ?? 'ADVISORY',
    affectedScope: overrides.affectedScope ?? 'TIMELINE',
    summaryKey: overrides.summaryKey ?? 'tracking.validation.detector1',
    evidenceSummary: overrides.evidenceSummary ?? 'Evidence A',
    isActive: overrides.isActive ?? true,
    ...(overrides.debugEvidence === undefined ? {} : { debugEvidence: overrides.debugEvidence }),
  }
}

function createState(
  overrides: Partial<TrackingValidationLifecycleState> = {},
): TrackingValidationLifecycleState {
  return {
    lifecycleKey: overrides.lifecycleKey ?? 'DETECTOR_1:container-1',
    issueCode: overrides.issueCode ?? 'DETECTOR_1',
    detectorId: overrides.detectorId ?? 'DETECTOR_1',
    detectorVersion: overrides.detectorVersion ?? '1',
    affectedScope: overrides.affectedScope ?? 'TIMELINE',
    severity: overrides.severity ?? 'ADVISORY',
    stateFingerprint: overrides.stateFingerprint ?? 'state-a',
    evidenceSummary: overrides.evidenceSummary ?? 'Evidence A',
    provider: overrides.provider ?? 'maersk',
    snapshotId: overrides.snapshotId ?? 'snapshot-prev',
    occurredAt: overrides.occurredAt ?? '2026-04-02T10:00:00.000Z',
  }
}

function createContext(
  overrides: Partial<TrackingValidationLifecycleTransitionContext> = {},
): TrackingValidationLifecycleTransitionContext {
  return {
    containerId: overrides.containerId ?? 'container-1',
    provider: overrides.provider ?? 'maersk',
    snapshotId: overrides.snapshotId ?? 'snapshot-next',
    occurredAt: overrides.occurredAt ?? '2026-04-03T10:00:00.000Z',
  }
}

describe('deriveTrackingValidationLifecycleTransitions', () => {
  it('emits activated when a new active finding appears', () => {
    const transitions = deriveTrackingValidationLifecycleTransitions({
      activeFindings: [
        createFinding({
          debugEvidence: {
            lifecycleSource: 'detector',
          },
        }),
      ],
      existingActiveStates: [],
      context: createContext(),
    })

    expect(transitions).toEqual([
      {
        containerId: 'container-1',
        transitionType: 'activated',
        lifecycleKey: 'DETECTOR_1:container-1',
        issueCode: 'DETECTOR_1',
        detectorId: 'DETECTOR_1',
        detectorVersion: '1',
        affectedScope: 'TIMELINE',
        severity: 'ADVISORY',
        stateFingerprint: 'state-a',
        evidenceSummary: 'Evidence A',
        provider: 'maersk',
        snapshotId: 'snapshot-next',
        occurredAt: '2026-04-03T10:00:00.000Z',
      },
    ])
    expect(transitions[0]).not.toHaveProperty('debugEvidence')
  })

  it('emits changed when the active finding fingerprint changes', () => {
    const transitions = deriveTrackingValidationLifecycleTransitions({
      activeFindings: [
        createFinding({ stateFingerprint: 'state-b', evidenceSummary: 'Evidence B' }),
      ],
      existingActiveStates: [createState()],
      context: createContext(),
    })

    expect(transitions).toHaveLength(1)
    expect(transitions[0]).toMatchObject({
      transitionType: 'changed',
      lifecycleKey: 'DETECTOR_1:container-1',
      stateFingerprint: 'state-b',
      evidenceSummary: 'Evidence B',
      snapshotId: 'snapshot-next',
    })
  })

  it('emits resolved when a previously active issue disappears', () => {
    const transitions = deriveTrackingValidationLifecycleTransitions({
      activeFindings: [],
      existingActiveStates: [createState()],
      context: createContext({
        provider: 'msc',
        snapshotId: 'snapshot-resolved',
        occurredAt: '2026-04-04T12:00:00.000Z',
      }),
    })

    expect(transitions).toEqual([
      {
        containerId: 'container-1',
        transitionType: 'resolved',
        lifecycleKey: 'DETECTOR_1:container-1',
        issueCode: 'DETECTOR_1',
        detectorId: 'DETECTOR_1',
        detectorVersion: '1',
        affectedScope: 'TIMELINE',
        severity: 'ADVISORY',
        stateFingerprint: 'state-a',
        evidenceSummary: 'Evidence A',
        provider: 'msc',
        snapshotId: 'snapshot-resolved',
        occurredAt: '2026-04-04T12:00:00.000Z',
      },
    ])
  })

  it('does not emit redundant transitions when the active state is unchanged', () => {
    const transitions = deriveTrackingValidationLifecycleTransitions({
      activeFindings: [createFinding()],
      existingActiveStates: [createState()],
      context: createContext(),
    })

    expect(transitions).toEqual([])
  })
})
