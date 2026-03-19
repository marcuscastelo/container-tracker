import { describe, expect, it } from 'vitest'

import { AgentLogIngestBodySchema } from '~/modules/agent/interface/http/agent-monitoring.schemas'

describe('AgentLogIngestBodySchema', () => {
  it('rejects message longer than 8192 chars', () => {
    const message = 'a'.repeat(8193)
    const result = AgentLogIngestBodySchema.safeParse({
      lines: [{ sequence: 0, channel: 'stdout', message }],
    })

    expect(result.success).toBe(false)
  })

  it('accepts message up to 8192 chars', () => {
    const message = 'a'.repeat(8192)
    const result = AgentLogIngestBodySchema.safeParse({
      lines: [{ sequence: 0, channel: 'stderr', message }],
    })

    expect(result.success).toBe(true)
  })
})
