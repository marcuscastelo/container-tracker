import { describe, expect, it, vi } from 'vitest'

import {
  type AgentSyncControllersDeps,
  createAgentSyncControllers,
} from '~/modules/tracking/interface/http/agent-sync.controllers'
import {
  GetAgentTargetsResponseSchema,
  IngestLeaseConflictResponseSchema,
  IngestSnapshotAcceptedResponseSchema,
  type SyncRequestRow,
} from '~/modules/tracking/interface/http/agent-sync.schemas'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const SYNC_REQUEST_ID = '22222222-2222-4222-8222-222222222222'
const SNAPSHOT_ID = '33333333-3333-4333-8333-333333333333'

function createSyncRequestRow(overrides: Partial<SyncRequestRow> = {}): SyncRequestRow {
  return {
    id: SYNC_REQUEST_ID,
    tenant_id: TENANT_ID,
    provider: 'msc',
    ref_type: 'container',
    ref_value: 'MSCU1234567',
    status: 'LEASED',
    priority: 10,
    leased_by: 'agent-1',
    leased_until: '2026-02-25T10:00:00.000Z',
    attempts: 1,
    last_error: null,
    created_at: '2026-02-25T09:00:00.000Z',
    updated_at: '2026-02-25T09:55:00.000Z',
    ...overrides,
  }
}

function createDeps(overrides: Partial<AgentSyncControllersDeps> = {}): AgentSyncControllersDeps {
  return {
    leaseSyncRequests: vi.fn(async () => []),
    findLeasedSyncRequest: vi.fn(async () => createSyncRequestRow()),
    markSyncRequestDone: vi.fn(async () => true),
    markSyncRequestFailed: vi.fn(async () => true),
    findContainersByNumber: vi.fn(async () => [
      {
        id: 'container-1',
        containerNumber: 'MSCU1234567',
        carrierCode: 'msc',
      },
    ]),
    saveAndProcess: vi.fn(async () => ({ snapshotId: SNAPSHOT_ID })),
    authenticateAgentToken: vi.fn(async () => ({ tenantId: TENANT_ID })),
    leaseMinutes: 5,
    ...overrides,
  }
}

describe('agent sync controllers', () => {
  it('returns 401 when authorization token is invalid', async () => {
    const deps = createDeps({
      authenticateAgentToken: vi.fn(async () => null),
    })
    const controllers = createAgentSyncControllers(deps)

    const request = new Request(`http://localhost/api/agent/targets?tenant_id=${TENANT_ID}`)
    const response = await controllers.getTargets({ request })

    expect(response.status).toBe(401)
  })

  it('accepts authorization header with extra bearer whitespace', async () => {
    const deps = createDeps()
    const controllers = createAgentSyncControllers(deps)

    const request = new Request(
      `http://localhost/api/agent/targets?tenant_id=${TENANT_ID}&limit=1`,
      {
        headers: {
          authorization: 'Bearer    token-123',
          'x-agent-id': 'agent-1',
        },
      },
    )
    const response = await controllers.getTargets({ request })

    expect(response.status).toBe(200)
    expect(deps.authenticateAgentToken).toHaveBeenCalledWith({
      token: 'token-123',
    })
  })

  it('returns 400 for invalid tenant_id query', async () => {
    const deps = createDeps()
    const controllers = createAgentSyncControllers(deps)

    const request = new Request('http://localhost/api/agent/targets?tenant_id=bad-value', {
      headers: { authorization: 'Bearer token-123' },
    })
    const response = await controllers.getTargets({ request })

    expect(response.status).toBe(400)
  })

  it('returns 403 when token tenant does not match query tenant_id', async () => {
    const deps = createDeps({
      authenticateAgentToken: vi.fn(async () => ({
        tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      })),
    })
    const controllers = createAgentSyncControllers(deps)

    const request = new Request(
      `http://localhost/api/agent/targets?tenant_id=${TENANT_ID}&limit=1`,
      {
        headers: {
          authorization: 'Bearer token-123',
          'x-agent-id': 'agent-1',
        },
      },
    )
    const response = await controllers.getTargets({ request })

    expect(response.status).toBe(403)
  })

  it('leases and returns targets', async () => {
    const deps = createDeps({
      leaseSyncRequests: vi.fn(async () => [createSyncRequestRow()]),
    })
    const controllers = createAgentSyncControllers(deps)

    const request = new Request(
      `http://localhost/api/agent/targets?tenant_id=${TENANT_ID}&limit=1`,
      {
        headers: {
          authorization: 'Bearer token-123',
          'x-agent-id': 'agent-1',
        },
      },
    )
    const response = await controllers.getTargets({ request })
    const body = GetAgentTargetsResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.targets).toHaveLength(1)
    expect(body.targets[0]?.sync_request_id).toBe(SYNC_REQUEST_ID)
    expect(body.leased_until).toBe('2026-02-25T10:00:00.000Z')
    expect(deps.leaseSyncRequests).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      agentId: 'agent-1',
      limit: 1,
      leaseMinutes: 5,
    })
  })

  it('ingests snapshot and marks sync request as DONE', async () => {
    const deps = createDeps()
    const controllers = createAgentSyncControllers(deps)

    const request = new Request('http://localhost/api/tracking/snapshots/ingest', {
      method: 'POST',
      headers: {
        authorization: 'Bearer token-123',
        'x-agent-id': 'agent-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        provider: 'msc',
        ref: { type: 'container', value: 'MSCU1234567' },
        observed_at: '2026-02-25T10:01:00.000Z',
        raw: { ok: true },
        meta: { agent_version: 'mvp-0.1' },
        sync_request_id: SYNC_REQUEST_ID,
      }),
    })

    const response = await controllers.ingestSnapshot({ request })
    const body = IngestSnapshotAcceptedResponseSchema.parse(await response.json())

    expect(response.status).toBe(202)
    expect(body.snapshot_id).toBe(SNAPSHOT_ID)
    expect(deps.markSyncRequestDone).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      syncRequestId: SYNC_REQUEST_ID,
      agentId: 'agent-1',
    })
  })

  it('returns 403 when token tenant does not match ingest payload tenant_id', async () => {
    const deps = createDeps({
      authenticateAgentToken: vi.fn(async () => ({
        tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      })),
    })
    const controllers = createAgentSyncControllers(deps)

    const request = new Request('http://localhost/api/tracking/snapshots/ingest', {
      method: 'POST',
      headers: {
        authorization: 'Bearer token-123',
        'x-agent-id': 'agent-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        provider: 'msc',
        ref: { type: 'container', value: 'MSCU1234567' },
        observed_at: '2026-02-25T10:01:00.000Z',
        raw: { ok: true },
        sync_request_id: SYNC_REQUEST_ID,
      }),
    })

    const response = await controllers.ingestSnapshot({ request })

    expect(response.status).toBe(403)
  })

  it('marks sync request as FAILED when container is not found', async () => {
    const deps = createDeps({
      findContainersByNumber: vi.fn(async () => []),
      markSyncRequestFailed: vi.fn(async () => true),
    })
    const controllers = createAgentSyncControllers(deps)

    const request = new Request('http://localhost/api/tracking/snapshots/ingest', {
      method: 'POST',
      headers: {
        authorization: 'Bearer token-123',
        'x-agent-id': 'agent-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        provider: 'msc',
        ref: { type: 'container', value: 'MSCU1234567' },
        observed_at: '2026-02-25T10:01:00.000Z',
        raw: { ok: true },
        sync_request_id: SYNC_REQUEST_ID,
      }),
    })

    const response = await controllers.ingestSnapshot({ request })
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(String(body.error)).toContain('No container found')
    expect(deps.markSyncRequestFailed).toHaveBeenCalledTimes(1)
  })

  it('marks sync request as FAILED when container is ambiguous', async () => {
    const deps = createDeps({
      findContainersByNumber: vi.fn(async () => [
        { id: 'container-1', containerNumber: 'MSCU1234567', carrierCode: 'msc' },
        { id: 'container-2', containerNumber: 'MSCU1234567', carrierCode: 'msc' },
      ]),
      markSyncRequestFailed: vi.fn(async () => true),
    })
    const controllers = createAgentSyncControllers(deps)

    const request = new Request('http://localhost/api/tracking/snapshots/ingest', {
      method: 'POST',
      headers: {
        authorization: 'Bearer token-123',
        'x-agent-id': 'agent-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        provider: 'msc',
        ref: { type: 'container', value: 'MSCU1234567' },
        observed_at: '2026-02-25T10:01:00.000Z',
        raw: { ok: true },
        sync_request_id: SYNC_REQUEST_ID,
      }),
    })

    const response = await controllers.ingestSnapshot({ request })
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(String(body.error)).toContain('Ambiguous container')
    expect(deps.markSyncRequestFailed).toHaveBeenCalledTimes(1)
  })

  it('returns lease_conflict when request is no longer leased', async () => {
    const deps = createDeps({
      findLeasedSyncRequest: vi.fn(async () => null),
    })
    const controllers = createAgentSyncControllers(deps)

    const request = new Request('http://localhost/api/tracking/snapshots/ingest', {
      method: 'POST',
      headers: {
        authorization: 'Bearer token-123',
        'x-agent-id': 'agent-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        provider: 'msc',
        ref: { type: 'container', value: 'MSCU1234567' },
        observed_at: '2026-02-25T10:01:00.000Z',
        raw: { ok: true },
        sync_request_id: SYNC_REQUEST_ID,
      }),
    })

    const response = await controllers.ingestSnapshot({ request })
    const body = IngestLeaseConflictResponseSchema.parse(await response.json())

    expect(response.status).toBe(409)
    expect(body.error).toBe('lease_conflict')
  })

  it('returns lease_conflict with snapshot_id when DONE update loses lease', async () => {
    const deps = createDeps({
      markSyncRequestDone: vi.fn(async () => false),
    })
    const controllers = createAgentSyncControllers(deps)

    const request = new Request('http://localhost/api/tracking/snapshots/ingest', {
      method: 'POST',
      headers: {
        authorization: 'Bearer token-123',
        'x-agent-id': 'agent-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        provider: 'msc',
        ref: { type: 'container', value: 'MSCU1234567' },
        observed_at: '2026-02-25T10:01:00.000Z',
        raw: { ok: true },
        sync_request_id: SYNC_REQUEST_ID,
      }),
    })

    const response = await controllers.ingestSnapshot({ request })
    const body = IngestLeaseConflictResponseSchema.parse(await response.json())

    expect(response.status).toBe(409)
    expect(body.error).toBe('lease_conflict')
    expect(body.snapshot_id).toBe(SNAPSHOT_ID)
  })
})
