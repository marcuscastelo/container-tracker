import { describe, expect, it, vi } from 'vitest'

const agentEnrollHandlers = vi.hoisted(() => ({
  enroll: vi.fn(),
}))

vi.mock('~/modules/tracking/interface/http/agent-enroll.controllers.bootstrap', () => ({
  bootstrapAgentEnrollControllers: () => ({
    enroll: agentEnrollHandlers.enroll,
  }),
}))

import { POST as enrollPost } from '~/routes/api/agent/enroll'

describe('agent enroll route', () => {
  it('binds POST /api/agent/enroll to agent-enroll controller', () => {
    expect(enrollPost).toBe(agentEnrollHandlers.enroll)
  })
})
