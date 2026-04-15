import { BackendSyncTargetsResponseDTOSchema } from '@agent/core/contracts/sync-job.contract'
import {
  toAgentSyncJob,
  toBackendSyncAck,
  toBackendSyncFailure,
  toProviderInput,
} from '@agent/sync/sync-job.mapper'
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

  it('maps agent job to provider input with execution hints and correlation ids', () => {
    const job = toAgentSyncJob({
      sync_request_id: '11111111-1111-4111-8111-111111111111',
      provider: 'maersk',
      ref_type: 'container',
      ref: 'MAEU1234567',
    })

    const providerInput = toProviderInput({
      job,
      config: {
        BACKEND_URL: 'https://api.example.com',
        SUPABASE_URL: null,
        SUPABASE_ANON_KEY: null,
        AGENT_TOKEN: 'token-123',
        TENANT_ID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        AGENT_ID: 'agent-a',
        INTERVAL_SEC: 30,
        LIMIT: 10,
        MAERSK_ENABLED: true,
        MAERSK_HEADLESS: false,
        MAERSK_TIMEOUT_MS: 90_000,
        MAERSK_USER_DATA_DIR: '/tmp/maersk-profile',
        AGENT_UPDATE_MANIFEST_CHANNEL: 'stable',
      },
      agentVersion: '1.2.3',
    })

    expect(providerInput.hints.maerskEnabled).toBe(true)
    expect(providerInput.hints.maerskTimeoutMs).toBe(90_000)
    expect(providerInput.correlation.agentVersion).toBe('1.2.3')
  })
})
