import { describe, expect, it } from 'vitest'

import { toHeartbeatCommand } from '~/modules/agent/interface/http/agent-monitoring.http.mappers'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const AGENT_ID = '22222222-2222-4222-8222-222222222222'

describe('toHeartbeatCommand', () => {
  it('maps update_channel when provided', () => {
    const command = toHeartbeatCommand({
      authenticatedAgentId: AGENT_ID,
      tenantId: TENANT_ID,
      payload: {
        tenant_id: TENANT_ID,
        update_channel: 'canary',
        activity: [],
      },
    })

    expect(command.updateChannel).toBe('canary')
  })

  it('keeps updateChannel undefined when payload does not provide update_channel', () => {
    const command = toHeartbeatCommand({
      authenticatedAgentId: AGENT_ID,
      tenantId: TENANT_ID,
      payload: {
        tenant_id: TENANT_ID,
        activity: [],
      },
    })

    expect(command.updateChannel).toBeUndefined()
  })
})
