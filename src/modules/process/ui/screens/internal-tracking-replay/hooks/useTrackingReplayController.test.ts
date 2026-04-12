import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchInternalTrackingReplayEnabledMock = vi.hoisted(() => vi.fn())
const lookupInternalTrackingReplayTargetMock = vi.hoisted(() => vi.fn())
const previewInternalTrackingReplayMock = vi.hoisted(() => vi.fn())
const applyInternalTrackingReplayMock = vi.hoisted(() => vi.fn())
const rollbackInternalTrackingReplayMock = vi.hoisted(() => vi.fn())
const fetchInternalTrackingReplayRunMock = vi.hoisted(() => vi.fn())

vi.mock('~/modules/process/ui/api/internal-tracking-replay.api', () => ({
  fetchInternalTrackingReplayEnabled: fetchInternalTrackingReplayEnabledMock,
  lookupInternalTrackingReplayTarget: lookupInternalTrackingReplayTargetMock,
  previewInternalTrackingReplay: previewInternalTrackingReplayMock,
  applyInternalTrackingReplay: applyInternalTrackingReplayMock,
  rollbackInternalTrackingReplay: rollbackInternalTrackingReplayMock,
  fetchInternalTrackingReplayRun: fetchInternalTrackingReplayRunMock,
}))

import { useTrackingReplayController } from '~/modules/process/ui/screens/internal-tracking-replay/hooks/useTrackingReplayController'
import { TypedFetchError } from '~/shared/api/typedFetch'

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function buildLookupResponse() {
  return {
    containerId: '11111111-1111-1111-1111-111111111111',
    containerNumber: 'TGBU7416510',
    provider: 'cmacgm',
    processId: '22222222-2222-2222-2222-222222222222',
    processReference: 'PROC-123',
    snapshotCount: 12,
    activeGenerationId: '33333333-3333-3333-3333-333333333333',
    previousGenerationId: '44444444-4444-4444-4444-444444444444',
    lastReplayRun: null,
  }
}

function buildRunResponse() {
  return {
    runId: '55555555-5555-5555-5555-555555555555',
    mode: 'DRY_RUN' as const,
    status: 'SUCCEEDED' as const,
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
      status: 'SUCCEEDED' as const,
      errorMessage: null,
      diffSummary: {
        snapshotCount: 12,
        currentGenerationId: '33333333-3333-3333-3333-333333333333',
        candidateGenerationId: '77777777-7777-7777-7777-777777777777',
        observationsCurrentCount: 20,
        observationsCandidateCount: 21,
        alertsCurrentCount: 2,
        alertsCandidateCount: 2,
        addedObservationFingerprints: ['added-fingerprint'],
        removedObservationFingerprints: [],
        statusChanged: false,
        statusBefore: 'IN_TRANSIT',
        statusAfter: 'IN_TRANSIT',
        alertsChanged: false,
        potentialTemporalConflicts: [],
      },
      createdGenerationId: '77777777-7777-7777-7777-777777777777',
      createdAt: '2026-04-12T10:00:00.000Z',
      updatedAt: '2026-04-12T10:00:10.000Z',
    },
  }
}

function createHarness() {
  return createRoot((dispose) => {
    const controller = useTrackingReplayController()
    return {
      controller,
      dispose,
    }
  })
}

describe('useTrackingReplayController', () => {
  beforeEach(() => {
    fetchInternalTrackingReplayEnabledMock.mockReset()
    lookupInternalTrackingReplayTargetMock.mockReset()
    previewInternalTrackingReplayMock.mockReset()
    applyInternalTrackingReplayMock.mockReset()
    rollbackInternalTrackingReplayMock.mockReset()
    fetchInternalTrackingReplayRunMock.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('marks route as disabled when enabled endpoint returns 404', async () => {
    fetchInternalTrackingReplayEnabledMock.mockRejectedValue(
      new TypedFetchError('Not found', 404, {}),
    )

    const harness = createHarness()
    await flushMicrotasks()

    expect(harness.controller.isDisabled()).toBe(true)
    expect(harness.controller.state()).toBe('empty')

    harness.dispose()
  })

  it('loads target on lookup and exposes ready state', async () => {
    fetchInternalTrackingReplayEnabledMock.mockResolvedValue({ enabled: true })
    lookupInternalTrackingReplayTargetMock.mockResolvedValue(buildLookupResponse())

    const harness = createHarness()
    await flushMicrotasks()

    harness.controller.setAuthTokenInput('token-123')
    harness.controller.setContainerNumberInput('tgbu7416510')
    await harness.controller.lookup()

    expect(harness.controller.state()).toBe('ready')
    expect(harness.controller.target()?.containerNumber).toBe('TGBU7416510')
    expect(lookupInternalTrackingReplayTargetMock).toHaveBeenLastCalledWith({
      authToken: 'token-123',
      containerNumber: 'TGBU7416510',
    })

    harness.dispose()
  })

  it('requires an access token before lookup', async () => {
    fetchInternalTrackingReplayEnabledMock.mockResolvedValue({ enabled: true })

    const harness = createHarness()
    await flushMicrotasks()

    harness.controller.setContainerNumberInput('TGBU7416510')
    await harness.controller.lookup()

    expect(harness.controller.errorMessage()).toBe('Provide replay access token.')
    expect(lookupInternalTrackingReplayTargetMock).not.toHaveBeenCalled()

    harness.dispose()
  })

  it('executes preview and updates run + diff data', async () => {
    fetchInternalTrackingReplayEnabledMock.mockResolvedValue({ enabled: true })
    lookupInternalTrackingReplayTargetMock
      .mockResolvedValueOnce(buildLookupResponse())
      .mockResolvedValueOnce(buildLookupResponse())
    previewInternalTrackingReplayMock.mockResolvedValue(buildRunResponse())

    const harness = createHarness()
    await flushMicrotasks()

    harness.controller.setAuthTokenInput('token-123')
    harness.controller.setContainerNumberInput('TGBU7416510')
    await harness.controller.lookup()
    harness.controller.setReasonInput('  preview reason  ')

    await harness.controller.preview()

    expect(previewInternalTrackingReplayMock).toHaveBeenCalledWith({
      authToken: 'token-123',
      containerId: '11111111-1111-1111-1111-111111111111',
      reason: 'preview reason',
    })
    expect(harness.controller.currentRun()?.runId).toBe('55555555-5555-5555-5555-555555555555')
    expect(harness.controller.diff()?.observationsCandidateCount).toBe(21)

    harness.dispose()
  })
})
