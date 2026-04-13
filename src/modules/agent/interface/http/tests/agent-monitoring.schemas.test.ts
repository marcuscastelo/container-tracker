import { describe, expect, it } from 'vitest'

import {
  AgentLogIngestBodySchema,
  AgentRemotePolicyPatchBodySchema,
  AgentRequestRestartBodySchema,
  AgentRequestUpdateBodySchema,
} from '~/modules/agent/interface/http/agent-monitoring.schemas'

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

describe('Agent request schemas', () => {
  it('requires reason for update requests', () => {
    const result = AgentRequestUpdateBodySchema.safeParse({
      desired_version: '1.2.3',
      update_channel: 'stable',
    })

    expect(result.success).toBe(false)
  })

  it('requires reason for restart requests', () => {
    const result = AgentRequestRestartBodySchema.safeParse({})

    expect(result.success).toBe(false)
  })

  it('requires at least one remote policy field besides reason', () => {
    const result = AgentRemotePolicyPatchBodySchema.safeParse({
      reason: 'maintenance',
    })

    expect(result.success).toBe(false)
  })

  it('accepts clearing desired version in remote policy patch', () => {
    const result = AgentRemotePolicyPatchBodySchema.safeParse({
      desired_version: null,
      reason: 'clear forced version',
    })

    expect(result.success).toBe(true)
  })
})
