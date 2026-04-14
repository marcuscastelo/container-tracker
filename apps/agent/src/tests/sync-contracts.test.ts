import { BackendSyncTargetsResponseDTOSchema } from '@agent/core/contracts/sync-job.contract'
import { toAgentSyncJob, toBackendSyncAck, toBackendSyncFailure } from '@agent/sync/sync-job.mapper'
import { describe, expect, it } from 'vitest'

describe('sync contracts', () => {
  it('maps canonical backend DTO to agent job', () => {
    const parsed = BackendSyncTargetsResponseDTOSchema.parse({
      targets: [
        {
          sync_request_id: '11111111-1111-4111-8111-111111111111',
          provider: 'msc',
          ref_type: 'container',
          ref: 'MSCU1234567',
        },
      ],
      leased_until: null,
      queue_lag_seconds: 0,
    })

    const job = toAgentSyncJob(parsed.targets[0])
    expect(job.syncRequestId).toBe('11111111-1111-4111-8111-111111111111')
    expect(job.provider).toBe('msc')
  })

  it('rejects legacy sync payload shape', () => {
    const parsed = BackendSyncTargetsResponseDTOSchema.safeParse({
      data: {
        items: [
          {
            syncRequestId: '11111111-1111-4111-8111-111111111111',
            provider: 'msc',
            refType: 'container',
            ref: 'MSCU1234567',
          },
        ],
      },
      leasedUntil: null,
      queueLagSeconds: 0,
    })

    expect(parsed.success).toBe(false)
  })

  it('maps provider outcome to backend ack/failure DTOs', () => {
    const job = toAgentSyncJob({
      sync_request_id: '11111111-1111-4111-8111-111111111111',
      provider: 'one',
      ref_type: 'container',
      ref: 'ONEU1234567',
    })

    const ack = toBackendSyncAck({
      job,
      snapshotId: '22222222-2222-4222-8222-222222222222',
      occurredAt: '2026-04-14T10:00:00.000Z',
      newObservationsCount: 4,
      newAlertsCount: 1,
    })

    const failure = toBackendSyncFailure({
      job,
      errorMessage: 'lease conflict',
      occurredAt: '2026-04-14T10:00:01.000Z',
      snapshotId: null,
    })

    expect(ack.status).toBe('DONE')
    expect(failure.status).toBe('FAILED')
  })
})
