import { describe, expect, it, vi } from 'vitest'

const agentControlHandlers = vi.hoisted(() => ({
  getInfraConfig: vi.fn(),
  getControlState: vi.fn(),
  acknowledgeControlCommand: vi.fn(),
}))

vi.mock('~/modules/agent/interface/http/agent-control.controllers.bootstrap', () => ({
  bootstrapAgentControlControllers: () => ({
    getInfraConfig: agentControlHandlers.getInfraConfig,
    getControlState: agentControlHandlers.getControlState,
    acknowledgeControlCommand: agentControlHandlers.acknowledgeControlCommand,
  }),
}))

import { POST as commandAckPost } from '~/routes/api/agent/control-commands/[id]/ack'
import { GET as controlStateGet } from '~/routes/api/agent/control-state'
import { GET as infraConfigGet } from '~/routes/api/agent/infra-config'

describe('agent control routes', () => {
  it('binds GET /api/agent/infra-config to control controller', () => {
    expect(infraConfigGet).toBe(agentControlHandlers.getInfraConfig)
  })

  it('binds GET /api/agent/control-state to control controller', () => {
    expect(controlStateGet).toBe(agentControlHandlers.getControlState)
  })

  it('binds POST /api/agent/control-commands/:id/ack to control controller', () => {
    expect(commandAckPost).toBe(agentControlHandlers.acknowledgeControlCommand)
  })
})
