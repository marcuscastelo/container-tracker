import { describe, expect, it } from 'vitest'
import { readAgentDetailSnapshot } from '~/modules/agent/ui/agentResourceSnapshot'

function buildErroredAgentDetailResource() {
  return {
    state: 'errored' as const,
    get latest(): never {
      throw new Error('agent detail resource latest should not be read')
    },
  }
}

describe('AgentDetailPage helpers', () => {
  it('reads the detail snapshot without touching the throwing resource accessor', () => {
    const resource = buildErroredAgentDetailResource()

    expect(readAgentDetailSnapshot(resource)).toBeUndefined()
  })
})
