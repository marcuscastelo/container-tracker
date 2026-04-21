import { beforeEach, describe, expect, it, vi } from 'vitest'

type ProcessSyncCandidateRow = {
  readonly id: string
  readonly archived_at?: string | null
  readonly reference?: string | null
}

type QueryOperation = {
  readonly method: 'select' | 'is' | 'or' | 'in' | 'eq' | 'rpc'
  readonly args: readonly unknown[]
}

type MockQuery = {
  readonly rows: readonly unknown[]
  select: (columns: string) => MockQuery
  is: (column: string, value: null) => MockQuery
  or: (filter: string) => MockQuery
  eq: (column: string, value: string) => MockQuery
  in: (column: string, values: readonly string[]) => MockQuery
}

const supabaseMock = vi.hoisted(() => {
  const state: {
    rows: readonly unknown[]
    rpcRows: unknown
    operations: QueryOperation[]
    tables: string[]
  } = {
    rows: [],
    rpcRows: [],
    operations: [],
    tables: [],
  }

  function createQuery(): MockQuery {
    const query: MockQuery = {
      get rows() {
        return state.rows
      },
      select(columns) {
        state.operations.push({
          method: 'select',
          args: [columns],
        })
        return query
      },
      is(column, value) {
        state.operations.push({
          method: 'is',
          args: [column, value],
        })
        return query
      },
      or(filter) {
        state.operations.push({
          method: 'or',
          args: [filter],
        })
        return query
      },
      eq(column, value) {
        state.operations.push({
          method: 'eq',
          args: [column, value],
        })
        return query
      },
      in(column, values) {
        state.operations.push({
          method: 'in',
          args: [column, values],
        })
        return query
      },
    }

    return query
  }

  return {
    reset(rows: readonly ProcessSyncCandidateRow[]) {
      state.rows = rows
      state.rpcRows = []
      state.operations = []
      state.tables = []
    },
    setRows(rows: readonly unknown[]) {
      state.rows = rows
      state.operations = []
      state.tables = []
    },
    setRpcRows(rows: unknown) {
      state.rpcRows = rows
      state.operations = []
      state.tables = []
    },
    state,
    from: vi.fn((table: string) => {
      state.tables.push(table)
      return createQuery()
    }),
    rpc: vi.fn((name: string, params: Readonly<Record<string, unknown>>) => {
      state.operations.push({
        method: 'rpc',
        args: [name, params],
      })
      return { rows: state.rpcRows }
    }),
    unwrap: vi.fn((result: { readonly rows: unknown }) => result.rows),
  }
})

vi.mock('~/shared/supabase/supabase.server', () => ({
  supabaseServer: {
    from: supabaseMock.from,
    rpc: supabaseMock.rpc,
  },
}))

vi.mock('~/shared/supabase/unwrapSupabaseResult', () => ({
  unwrapSupabaseResultOrThrow: supabaseMock.unwrap,
}))

import {
  createRefreshProcessDeps,
  createSyncQueuePort,
  createSyncStatusReadPort,
  createSyncTargetReadPort,
} from '~/shared/api/sync.bootstrap/sync.bootstrap.ports'

describe('createSyncStatusReadPort', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('scopes default polling candidates to active and recently archived processes', async () => {
    supabaseMock.reset([
      { id: 'process-active', archived_at: null },
      { id: 'process-recently-archived', archived_at: '2026-03-10T00:00:00.000Z' },
    ])

    const port = createSyncStatusReadPort({
      targetReadPort: {
        fetchProcessById: vi.fn(),
        listActiveProcessesForDashboardSync: vi.fn(),
        listActiveProcessIds: vi.fn(),
        listContainersByProcessId: vi.fn(),
        listContainersByProcessIds: vi.fn(),
        findContainersByNumber: vi.fn(),
      },
      defaultTenantId: 'tenant-1',
      nowFactory: () => new Date('2026-03-13T15:00:00.000Z'),
    })

    const candidates = await port.listProcessSyncCandidates()

    expect(candidates).toEqual([
      { processId: 'process-active', archivedAt: null },
      {
        processId: 'process-recently-archived',
        archivedAt: '2026-03-10T00:00:00.000Z',
      },
    ])
    expect(supabaseMock.state.tables).toEqual(['processes'])
    expect(supabaseMock.state.operations).toContainEqual({
      method: 'or',
      args: ['archived_at.is.null,archived_at.gt.2026-03-06T15:00:00.000Z'],
    })
  })

  it('uses explicit processIds scope instead of the recent-archive polling filter', async () => {
    supabaseMock.reset([{ id: 'process-archived', archived_at: '2025-01-01T00:00:00.000Z' }])

    const port = createSyncStatusReadPort({
      targetReadPort: {
        fetchProcessById: vi.fn(),
        listActiveProcessesForDashboardSync: vi.fn(),
        listActiveProcessIds: vi.fn(),
        listContainersByProcessId: vi.fn(),
        listContainersByProcessIds: vi.fn(),
        findContainersByNumber: vi.fn(),
      },
      defaultTenantId: 'tenant-1',
    })

    const candidates = await port.listProcessSyncCandidates({
      processIds: [' process-archived ', 'process-2', 'process-archived'],
    })

    expect(candidates).toEqual([
      {
        processId: 'process-archived',
        archivedAt: '2025-01-01T00:00:00.000Z',
      },
    ])
    expect(supabaseMock.state.operations).toContainEqual({
      method: 'in',
      args: ['id', ['process-archived', 'process-2']],
    })
    expect(supabaseMock.state.operations.some((operation) => operation.method === 'or')).toBeFalsy()
  })

  it('returns no candidates for an explicit empty processIds scope', async () => {
    supabaseMock.reset([{ id: 'process-1', archived_at: null }])

    const port = createSyncStatusReadPort({
      targetReadPort: {
        fetchProcessById: vi.fn(),
        listActiveProcessesForDashboardSync: vi.fn(),
        listActiveProcessIds: vi.fn(),
        listContainersByProcessId: vi.fn(),
        listContainersByProcessIds: vi.fn(),
        findContainersByNumber: vi.fn(),
      },
      defaultTenantId: 'tenant-1',
    })

    const candidates = await port.listProcessSyncCandidates({
      processIds: [],
    })

    expect(candidates).toEqual([])
    expect(supabaseMock.from).not.toHaveBeenCalled()
  })

  it('normalizes container sync-request lookup and preserves requested status order', async () => {
    supabaseMock.setRows([
      {
        id: '11111111-1111-4111-8111-111111111111',
        status: 'DONE',
        last_error: null,
        updated_at: '2026-04-10T10:00:00.000Z',
        ref_value: 'MSCU1234567',
      },
    ])
    const queuePort = createSyncQueuePort({
      defaultTenantId: 'tenant-1',
    })

    const result = await queuePort.getSyncRequestStatuses({
      syncRequestIds: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        '11111111-1111-4111-8111-111111111111',
      ],
    })

    expect(result).toEqual({
      allTerminal: true,
      requests: [
        {
          syncRequestId: '11111111-1111-4111-8111-111111111111',
          status: 'DONE',
          lastError: null,
          updatedAt: '2026-04-10T10:00:00.000Z',
          refValue: 'MSCU1234567',
        },
        {
          syncRequestId: '22222222-2222-4222-8222-222222222222',
          status: 'NOT_FOUND',
          lastError: 'sync_request_not_found',
          updatedAt: null,
          refValue: null,
        },
        {
          syncRequestId: '11111111-1111-4111-8111-111111111111',
          status: 'DONE',
          lastError: null,
          updatedAt: '2026-04-10T10:00:00.000Z',
          refValue: 'MSCU1234567',
        },
      ],
    })
    expect(supabaseMock.state.operations).toContainEqual({
      method: 'in',
      args: [
        'id',
        ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
      ],
    })
  })

  it('enqueues normalized container sync requests through the queue port', async () => {
    supabaseMock.rpc
      .mockImplementationOnce((name: string, params: Readonly<Record<string, unknown>>) => {
        supabaseMock.state.operations.push({
          method: 'rpc',
          args: [name, params],
        })
        return { rows: false }
      })
      .mockImplementationOnce((name: string, params: Readonly<Record<string, unknown>>) => {
        supabaseMock.state.operations.push({
          method: 'rpc',
          args: [name, params],
        })
        return {
          rows: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              status: 'PENDING',
              is_new: true,
            },
          ],
        }
      })
    const queuePort = createSyncQueuePort({
      defaultTenantId: 'tenant-1',
    })

    const result = await queuePort.enqueueContainerSyncRequest({
      tenantId: 'tenant-2',
      provider: 'msc',
      containerNumber: ' mscu1234567 ',
      mode: 'backfill',
    })

    expect(result).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      status: 'PENDING',
      isNew: true,
    })
    expect(supabaseMock.state.operations).toContainEqual({
      method: 'rpc',
      args: [
        'enqueue_sync_request',
        {
          p_tenant_id: 'tenant-2',
          p_provider: 'msc',
          p_ref_type: 'container',
          p_ref_value: 'MSCU1234567',
          p_priority: -1,
        },
      ],
    })
  })
})

describe('createSyncTargetReadPort', () => {
  it('lists active dashboard sync processes with process references', async () => {
    supabaseMock.reset([
      { id: 'process-1', reference: 'REF-001' },
      { id: 'process-2', reference: null },
    ])

    const port = createSyncTargetReadPort({
      processUseCases: {
        findProcessById: vi.fn(),
      },
      containerUseCases: {
        listByProcessId: vi.fn(),
        listByProcessIds: vi.fn(async () => ({
          containersByProcessId: new Map(),
        })),
        findByNumbers: vi.fn(),
      },
    })

    const result = await port.listActiveProcessesForDashboardSync()

    expect(result).toEqual([
      { processId: 'process-1', processReference: 'REF-001' },
      { processId: 'process-2', processReference: null },
    ])
  })

  it('lists active process ids without depending on method binding', async () => {
    supabaseMock.reset([
      { id: 'process-1', reference: 'REF-001' },
      { id: 'process-2', reference: null },
    ])

    const port = createSyncTargetReadPort({
      processUseCases: {
        findProcessById: vi.fn(),
      },
      containerUseCases: {
        listByProcessId: vi.fn(),
        listByProcessIds: vi.fn(async () => ({
          containersByProcessId: new Map(),
        })),
        findByNumbers: vi.fn(),
      },
    })

    const listActiveProcessIds = port.listActiveProcessIds
    await expect(listActiveProcessIds()).resolves.toEqual(['process-1', 'process-2'])
  })

  it('maps container application results into sync target records without exposing entities', async () => {
    const port = createSyncTargetReadPort({
      processUseCases: {
        findProcessById: vi.fn(),
      },
      containerUseCases: {
        listByProcessId: vi.fn(),
        listByProcessIds: vi.fn(async () => ({
          containersByProcessId: new Map([
            [
              'process-1',
              [
                {
                  processId: 'process-1',
                  containerNumber: 'MSCU1234567',
                  carrierCode: 'MSC',
                },
              ],
            ],
          ]),
        })),
        findByNumbers: vi.fn(),
      },
    })

    const result = await port.listContainersByProcessIds({
      processIds: ['process-1'],
    })

    expect(result.containersByProcessId.get('process-1')).toEqual([
      {
        processId: 'process-1',
        containerNumber: 'MSCU1234567',
        carrierCode: 'MSC',
      },
    ])
  })
})

describe('createRefreshProcessDeps', () => {
  it('injects tenant and manual mode while delegating provider/container facts to queue port', async () => {
    const queuePort = {
      enqueueContainerSyncRequest: vi.fn(async () => ({
        id: '11111111-1111-4111-8111-111111111111',
        status: 'PENDING' as const,
        isNew: true,
      })),
      getSyncRequestStatuses: vi.fn(),
    }
    const deps = createRefreshProcessDeps({
      targetReadPort: {
        fetchProcessById: vi.fn(),
        listActiveProcessesForDashboardSync: vi.fn(),
        listActiveProcessIds: vi.fn(),
        listContainersByProcessId: vi.fn(),
        listContainersByProcessIds: vi.fn(),
        findContainersByNumber: vi.fn(),
      },
      queuePort,
      defaultTenantId: 'tenant-1',
    })

    await deps.enqueueContainerSyncRequest({
      provider: 'msc',
      containerNumber: 'MSCU1234567',
    })

    expect(queuePort.enqueueContainerSyncRequest).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      mode: 'manual',
      provider: 'msc',
      containerNumber: 'MSCU1234567',
    })
  })
})
