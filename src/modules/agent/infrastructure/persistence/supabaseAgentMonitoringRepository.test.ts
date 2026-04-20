import { describe, expect, it, vi } from 'vitest'

const trackingAgentUpdates: unknown[] = []
const commandInserts: unknown[] = []

vi.mock('~/shared/supabase/supabase.server', () => {
  let trackingCallIndex = 0

  function buildPreviousStateQuery() {
    const query = {
      select() {
        return query
      },
      eq() {
        return query
      },
      is() {
        return query
      },
      async maybeSingle() {
        return {
          data: {
            restart_requested_at: '2026-04-10T10:00:00.000Z',
            updater_state: 'idle',
          },
          error: null,
        }
      },
    }
    return query
  }

  function buildStateUpdateQuery() {
    const query = {
      update(patch: unknown) {
        trackingAgentUpdates.push(patch)
        return query
      },
      eq() {
        return query
      },
      is() {
        return query
      },
      select() {
        return query
      },
      async maybeSingle() {
        return {
          data: { id: 'agent-row' },
          error: null,
        }
      },
    }
    return query
  }

  function buildRollbackQuery() {
    const query = {
      update(patch: unknown) {
        trackingAgentUpdates.push(patch)
        return query
      },
      eq() {
        return query
      },
      is() {
        return query
      },
      async select() {
        return {
          data: [{ id: 'rollback-row' }],
          error: null,
        }
      },
    }
    return query
  }

  function buildControlCommandInsertQuery() {
    const query = {
      insert(payload: unknown) {
        commandInserts.push(payload)
        return query
      },
      async select() {
        return {
          data: null,
          error: new Error('failed to enqueue reset command'),
        }
      },
    }
    return query
  }

  return {
    supabaseServer: {
      from(table: string) {
        if (table === 'tracking_agents') {
          trackingCallIndex += 1
          if (trackingCallIndex === 1) {
            return buildPreviousStateQuery()
          }

          if (trackingCallIndex === 2) {
            return buildStateUpdateQuery()
          }

          return buildRollbackQuery()
        }

        if (table === 'agent_control_commands') {
          return buildControlCommandInsertQuery()
        }

        throw new Error(`unexpected table in test mock: ${table}`)
      },
    },
  }
})

vi.mock('~/shared/supabase/unwrapSupabaseResult', () => ({
  unwrapSupabaseSingleOrNull(result: { readonly data: unknown; readonly error: unknown }) {
    if (result.error) {
      throw result.error
    }
    return result.data
  },
  unwrapSupabaseResultOrThrow(result: { readonly data: unknown; readonly error: unknown }) {
    if (result.error) {
      throw result.error
    }
    return result.data
  },
}))

describe('supabaseAgentMonitoringRepository.requestAgentReset', () => {
  it('rolls back tracking state when enqueueing the reset command fails', async () => {
    trackingAgentUpdates.length = 0
    commandInserts.length = 0

    const { supabaseAgentMonitoringRepository } = await import(
      '~/modules/agent/infrastructure/persistence/supabaseAgentMonitoringRepository'
    )

    const requestedAt = '2026-04-15T12:00:00.000Z'

    await expect(
      supabaseAgentMonitoringRepository.requestAgentReset({
        tenantId: '11111111-1111-4111-8111-111111111111',
        agentId: '22222222-2222-4222-8222-222222222222',
        requestedAt,
      }),
    ).rejects.toThrow('failed to enqueue reset command')

    expect(commandInserts).toHaveLength(1)
    expect(trackingAgentUpdates).toEqual([
      {
        restart_requested_at: requestedAt,
        updater_state: 'draining',
      },
      {
        restart_requested_at: '2026-04-10T10:00:00.000Z',
        updater_state: 'idle',
      },
    ])
  })
})
