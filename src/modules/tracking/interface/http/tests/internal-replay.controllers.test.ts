import { describe, expect, it, vi } from 'vitest'
import { createInternalReplayControllers } from '~/modules/tracking/interface/http/internal-replay.controllers'
import {
  ReplayLookupResponseSchema,
  ReplayRollbackResponseSchema,
  ReplayRunResponseSchema,
} from '~/modules/tracking/interface/http/internal-replay.schemas'
import { HttpError } from '~/shared/errors/httpErrors'

const RUN_ID = '11111111-1111-4111-8111-111111111111'
const RUN_TARGET_ID = '22222222-2222-4222-8222-222222222222'
const CONTAINER_ID = '33333333-3333-4333-8333-333333333333'
const CURRENT_GENERATION_ID = '44444444-4444-4444-8444-444444444444'
const CANDIDATE_GENERATION_ID = '55555555-5555-4555-8555-555555555555'
const PROCESS_ID = '66666666-6666-4666-8666-666666666666'
const PREVIOUS_GENERATION_ID = '77777777-7777-4777-8777-777777777777'
const ROLLBACK_ACTIVE_GENERATION_ID = '88888888-8888-4888-8888-888888888888'
const ROLLBACK_PREVIOUS_GENERATION_ID = '99999999-9999-4999-8999-999999999999'

function makeRunResponse() {
  return {
    runId: RUN_ID,
    mode: 'DRY_RUN' as const,
    status: 'SUCCEEDED' as const,
    requestedBy: 'internal-user',
    reason: 'test',
    createdAt: '2026-04-12T10:00:00.000Z',
    startedAt: '2026-04-12T10:00:01.000Z',
    finishedAt: '2026-04-12T10:00:10.000Z',
    codeVersion: 'abc123',
    errorMessage: null,
    summary: {},
    target: {
      targetId: RUN_TARGET_ID,
      containerId: CONTAINER_ID,
      containerNumber: 'TGBU7416510',
      provider: 'cmacgm',
      snapshotCount: 12,
      status: 'SUCCEEDED' as const,
      errorMessage: null,
      diffSummary: {
        snapshotCount: 12,
        currentGenerationId: CURRENT_GENERATION_ID,
        candidateGenerationId: CANDIDATE_GENERATION_ID,
        observationsCurrentCount: 20,
        observationsCandidateCount: 21,
        alertsCurrentCount: 2,
        alertsCandidateCount: 2,
        addedObservationFingerprints: ['added-fp'],
        removedObservationFingerprints: [],
        statusChanged: false,
        statusBefore: 'IN_TRANSIT',
        statusAfter: 'IN_TRANSIT',
        alertsChanged: false,
        potentialTemporalConflicts: [],
      },
      createdGenerationId: CANDIDATE_GENERATION_ID,
      createdAt: '2026-04-12T10:00:00.000Z',
      updatedAt: '2026-04-12T10:00:10.000Z',
    },
  }
}

describe('internal replay controllers', () => {
  it('returns 404 for all endpoints when internal replay is disabled', async () => {
    const controllers = createInternalReplayControllers({
      trackingUseCases: {
        lookupTrackingReplayTarget: vi.fn(),
        previewTrackingReplay: vi.fn(),
        applyTrackingReplay: vi.fn(),
        rollbackTrackingReplay: vi.fn(),
        getTrackingReplayRun: vi.fn(),
      },
      isEnabled: () => false,
      resolveCodeVersion: () => null,
    })

    const lookupResponse = await controllers.lookup({
      request: new Request('http://localhost/api/internal/tracking-replay/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containerNumber: 'TGBU7416510' }),
      }),
    })

    const enabledResponse = await controllers.enabled()

    expect(lookupResponse.status).toBe(404)
    expect(enabledResponse.status).toBe(404)
  })

  it('looks up replay target and returns typed payload', async () => {
    const lookupTrackingReplayTarget = vi.fn(async () => ({
      containerId: CONTAINER_ID,
      containerNumber: 'TGBU7416510',
      provider: 'cmacgm',
      processId: PROCESS_ID,
      processReference: 'PROC-123',
      snapshotCount: 12,
      activeGenerationId: CURRENT_GENERATION_ID,
      previousGenerationId: PREVIOUS_GENERATION_ID,
      lastReplayRun: null,
    }))

    const controllers = createInternalReplayControllers({
      trackingUseCases: {
        lookupTrackingReplayTarget,
        previewTrackingReplay: vi.fn(),
        applyTrackingReplay: vi.fn(),
        rollbackTrackingReplay: vi.fn(),
        getTrackingReplayRun: vi.fn(),
      },
      isEnabled: () => true,
      resolveCodeVersion: () => null,
    })

    const response = await controllers.lookup({
      request: new Request('http://localhost/api/internal/tracking-replay/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containerNumber: 'TGBU7416510' }),
      }),
    })

    const rawBody = await response.json()
    expect(response.status).toBe(200)
    expect(rawBody).not.toHaveProperty('error')
    const body = ReplayLookupResponseSchema.parse(rawBody)
    expect(body.containerNumber).toBe('TGBU7416510')
    expect(lookupTrackingReplayTarget).toHaveBeenCalledWith({
      containerNumber: 'TGBU7416510',
    })
  })

  it('trims reason and forwards requestedBy header when previewing replay', async () => {
    const previewTrackingReplay = vi.fn(async () => ({ run: makeRunResponse() }))

    const controllers = createInternalReplayControllers({
      trackingUseCases: {
        lookupTrackingReplayTarget: vi.fn(),
        previewTrackingReplay,
        applyTrackingReplay: vi.fn(),
        rollbackTrackingReplay: vi.fn(),
        getTrackingReplayRun: vi.fn(),
      },
      isEnabled: () => true,
      resolveCodeVersion: () => 'commit-sha',
    })

    const response = await controllers.preview({
      request: new Request('http://localhost/api/internal/tracking-replay/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-user': 'ops@container-tracker',
        },
        body: JSON.stringify({
          containerId: CONTAINER_ID,
          reason: '  replay for validation  ',
        }),
      }),
    })

    expect(response.status).toBe(200)
    const rawBody = await response.json()
    expect(rawBody).not.toHaveProperty('error')
    const body = ReplayRunResponseSchema.parse(rawBody)
    expect(body.runId).toBe(RUN_ID)
    expect(previewTrackingReplay).toHaveBeenCalledWith({
      containerId: CONTAINER_ID,
      reason: 'replay for validation',
      requestedBy: 'ops@container-tracker',
      codeVersion: 'commit-sha',
    })
  })

  it('returns rollback payload when rollback succeeds', async () => {
    const rollbackTrackingReplay = vi.fn(async () => ({
      runId: RUN_ID,
      status: 'ROLLED_BACK' as const,
      activeGenerationId: ROLLBACK_ACTIVE_GENERATION_ID,
      previousGenerationId: ROLLBACK_PREVIOUS_GENERATION_ID,
    }))

    const controllers = createInternalReplayControllers({
      trackingUseCases: {
        lookupTrackingReplayTarget: vi.fn(),
        previewTrackingReplay: vi.fn(),
        applyTrackingReplay: vi.fn(),
        rollbackTrackingReplay,
        getTrackingReplayRun: vi.fn(),
      },
      isEnabled: () => true,
      resolveCodeVersion: () => null,
    })

    const response = await controllers.rollback({
      request: new Request('http://localhost/api/internal/tracking-replay/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          containerId: CONTAINER_ID,
          reason: null,
        }),
      }),
    })

    expect(response.status).toBe(200)
    const rawBody = await response.json()
    expect(rawBody).not.toHaveProperty('error')
    const body = ReplayRollbackResponseSchema.parse(rawBody)
    expect(body.status).toBe('ROLLED_BACK')
    expect(rollbackTrackingReplay).toHaveBeenCalledWith({
      containerId: CONTAINER_ID,
      reason: null,
      requestedBy: 'internal-tracking-replay-ui',
      codeVersion: null,
    })
  })

  it('maps zod validation failure to 400', async () => {
    const controllers = createInternalReplayControllers({
      trackingUseCases: {
        lookupTrackingReplayTarget: vi.fn(),
        previewTrackingReplay: vi.fn(),
        applyTrackingReplay: vi.fn(),
        rollbackTrackingReplay: vi.fn(),
        getTrackingReplayRun: vi.fn(),
      },
      isEnabled: () => true,
      resolveCodeVersion: () => null,
    })

    const response = await controllers.lookup({
      request: new Request('http://localhost/api/internal/tracking-replay/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containerNumber: '' }),
      }),
    })

    expect(response.status).toBe(400)
  })

  it('maps use case HttpError to status code', async () => {
    const controllers = createInternalReplayControllers({
      trackingUseCases: {
        lookupTrackingReplayTarget: vi.fn(async () => {
          throw new HttpError('tracking_replay_container_not_found', 404)
        }),
        previewTrackingReplay: vi.fn(),
        applyTrackingReplay: vi.fn(),
        rollbackTrackingReplay: vi.fn(),
        getTrackingReplayRun: vi.fn(),
      },
      isEnabled: () => true,
      resolveCodeVersion: () => null,
    })

    const response = await controllers.lookup({
      request: new Request('http://localhost/api/internal/tracking-replay/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containerNumber: 'TGBU7416510' }),
      }),
    })

    const payload = await response.json()
    expect(payload).toEqual(
      expect.objectContaining({
        error: expect.any(String),
      }),
    )

    expect(response.status).toBe(404)
    expect(payload.error).toBe('tracking_replay_container_not_found')
  })
})
