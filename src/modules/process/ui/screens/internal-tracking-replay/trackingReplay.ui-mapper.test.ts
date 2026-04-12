import { describe, expect, it } from 'vitest'
import {
  toTrackingReplayDiffVm,
  toTrackingReplayRunVm,
  toTrackingReplayTargetVm,
} from '~/modules/process/ui/screens/internal-tracking-replay/trackingReplay.ui-mapper'

describe('trackingReplay.ui-mapper', () => {
  it('maps lookup dto to target vm', () => {
    const vm = toTrackingReplayTargetVm({
      containerId: '11111111-1111-1111-1111-111111111111',
      containerNumber: 'TGBU7416510',
      provider: 'cmacgm',
      processId: '22222222-2222-2222-2222-222222222222',
      processReference: 'PROC-123',
      snapshotCount: 12,
      activeGenerationId: '33333333-3333-3333-3333-333333333333',
      previousGenerationId: '44444444-4444-4444-4444-444444444444',
      lastReplayRun: {
        runId: '55555555-5555-5555-5555-555555555555',
        mode: 'DRY_RUN',
        status: 'SUCCEEDED',
        createdAt: '2026-04-12T10:00:00.000Z',
      },
    })

    expect(vm.containerNumber).toBe('TGBU7416510')
    expect(vm.snapshotCount).toBe(12)
    expect(vm.lastReplayRun?.mode).toBe('DRY_RUN')
  })

  it('maps run dto and diff dto without semantic derivation', () => {
    const run = {
      runId: '55555555-5555-5555-5555-555555555555',
      mode: 'APPLY' as const,
      status: 'APPLIED' as const,
      requestedBy: 'internal-user',
      reason: null,
      createdAt: '2026-04-12T10:00:00.000Z',
      startedAt: '2026-04-12T10:00:01.000Z',
      finishedAt: '2026-04-12T10:00:10.000Z',
      codeVersion: null,
      errorMessage: null,
      summary: {},
      target: {
        targetId: '66666666-6666-6666-6666-666666666666',
        containerId: '11111111-1111-1111-1111-111111111111',
        containerNumber: 'TGBU7416510',
        provider: 'cmacgm',
        snapshotCount: 12,
        status: 'APPLIED' as const,
        errorMessage: null,
        diffSummary: {
          snapshotCount: 12,
          currentGenerationId: '77777777-7777-7777-7777-777777777777',
          candidateGenerationId: '88888888-8888-8888-8888-888888888888',
          observationsCurrentCount: 20,
          observationsCandidateCount: 21,
          alertsCurrentCount: 2,
          alertsCandidateCount: 3,
          addedObservationFingerprints: ['added-fingerprint'],
          removedObservationFingerprints: ['removed-fingerprint'],
          statusChanged: true,
          statusBefore: 'IN_TRANSIT',
          statusAfter: 'ARRIVED',
          alertsChanged: true,
          potentialTemporalConflicts: [
            {
              fingerprintKey: 'ARRIVAL|SANTOS|VESSEL-A',
              rawEventTime: '2026-04-12 10:00',
              beforeInstant: '2026-04-12T13:00:00.000Z',
              afterInstant: '2026-04-12T12:00:00.000Z',
            },
          ],
        },
        createdGenerationId: '88888888-8888-8888-8888-888888888888',
        createdAt: '2026-04-12T10:00:00.000Z',
        updatedAt: '2026-04-12T10:00:10.000Z',
      },
    }

    const runVm = toTrackingReplayRunVm(run)
    const diffVm = toTrackingReplayDiffVm(run)

    expect(runVm.mode).toBe('APPLY')
    expect(runVm.status).toBe('APPLIED')
    expect(diffVm?.alertsChanged).toBe(true)
    expect(diffVm?.statusAfter).toBe('ARRIVED')
    expect(diffVm?.potentialTemporalConflicts[0]?.fingerprintKey).toBe('ARRIVAL|SANTOS|VESSEL-A')
  })
})
