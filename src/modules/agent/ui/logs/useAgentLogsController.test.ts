import { describe, expect, it } from 'vitest'
import { readAgentLogsBacklogSnapshot } from '~/modules/agent/ui/logs/useAgentLogsController'

function buildErroredAgentLogsResource() {
  return {
    state: 'errored' as const,
    get latest(): never {
      throw new Error('agent logs resource latest should not be read')
    },
  }
}

describe('useAgentLogsController helpers', () => {
  it('reads backlog snapshots safely without touching the throwing resource accessor', () => {
    const resource = buildErroredAgentLogsResource()

    expect(readAgentLogsBacklogSnapshot(resource)).toBeUndefined()
  })
})
