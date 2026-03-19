import { beforeEach, describe, expect, it, vi } from 'vitest'

type ProcessSyncCandidateRow = {
  readonly id: string
  readonly archived_at: string | null
}

type QueryOperation = {
  readonly method: 'select' | 'is' | 'or' | 'in'
  readonly args: readonly unknown[]
}

type MockQuery = {
  readonly rows: readonly ProcessSyncCandidateRow[]
  select: (columns: string) => MockQuery
  is: (column: string, value: null) => MockQuery
  or: (filter: string) => MockQuery
  in: (column: string, values: readonly string[]) => MockQuery
}

const supabaseMock = vi.hoisted(() => {
  const state: {
    rows: readonly ProcessSyncCandidateRow[]
    operations: QueryOperation[]
    tables: string[]
  } = {
    rows: [],
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
      state.operations = []
      state.tables = []
    },
    state,
    from: vi.fn((table: string) => {
      state.tables.push(table)
      return createQuery()
    }),
    unwrap: vi.fn((result: { readonly rows: readonly ProcessSyncCandidateRow[] }) => result.rows),
  }
})

vi.mock('~/shared/supabase/supabase.server', () => ({
  supabaseServer: {
    from: supabaseMock.from,
  },
}))

vi.mock('~/shared/supabase/unwrapSupabaseResult', () => ({
  unwrapSupabaseResultOrThrow: supabaseMock.unwrap,
}))

import { createSyncStatusReadPort } from '~/shared/api/sync.bootstrap/sync.bootstrap.ports'

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
})
