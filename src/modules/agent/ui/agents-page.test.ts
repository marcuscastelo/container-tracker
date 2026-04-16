import { describe, expect, it } from 'vitest'
import { readAgentListResponseSnapshot } from '~/modules/agent/ui/agentResourceSnapshot'

function buildErroredAgentListResource() {
  return {
    state: 'errored' as const,
    get latest(): never {
      throw new Error('agent list resource latest should not be read')
    },
  }
}

describe('AgentsPage helpers', () => {
  it('reads the list snapshot without touching the throwing resource accessor', () => {
    const resource = buildErroredAgentListResource()

    expect(readAgentListResponseSnapshot(resource)).toBeUndefined()
  })
})
