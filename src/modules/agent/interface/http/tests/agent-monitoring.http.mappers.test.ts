import { describe, expect, it } from 'vitest'

import {
  toAgentLogIngestCommand,
  toAgentLogsCommand,
  toHeartbeatCommand,
} from '~/modules/agent/interface/http/agent-monitoring.http.mappers'

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

  it('maps logs_supported capability flag', () => {
    const command = toHeartbeatCommand({
      authenticatedAgentId: AGENT_ID,
      tenantId: TENANT_ID,
      payload: {
        tenant_id: TENANT_ID,
        logs_supported: true,
        activity: [],
      },
    })

    expect(command.logsSupported).toBe(true)
  })
})

describe('agent logs mappers', () => {
  it('maps logs query DTO to use case command', () => {
    const command = toAgentLogsCommand({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
      query: {
        channel: 'stderr',
        tail: 250,
      },
    })

    expect(command).toEqual({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
      channel: 'stderr',
      tail: 250,
    })
  })

  it('maps ingest payload lines to use case command shape', () => {
    const command = toAgentLogIngestCommand({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
      payload: {
        lines: [
          {
            sequence: 11,
            channel: 'stdout',
            message: 'line',
            occurred_at: '2026-03-14T10:00:00.000Z',
            truncated: false,
          },
        ],
      },
    })

    expect(command.lines[0]).toEqual({
      sequence: 11,
      channel: 'stdout',
      message: 'line',
      occurredAt: '2026-03-14T10:00:00.000Z',
      truncated: false,
    })
  })
})
