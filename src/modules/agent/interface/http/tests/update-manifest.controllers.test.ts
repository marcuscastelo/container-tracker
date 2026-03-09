import { describe, expect, it, vi } from 'vitest'

import { AgentUpdateManifestResponseSchema } from '~/modules/agent/interface/http/agent-monitoring.schemas'
import { createUpdateManifestControllers } from '~/modules/agent/interface/http/update-manifest.controllers'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const AGENT_ID = '22222222-2222-4222-8222-222222222222'

function createControllers(command: {
  readonly authResult?: {
    readonly tenantId: string
    readonly agentId: string
    readonly hostname: string
    readonly intervalSec: number
    readonly capabilities: readonly string[]
  } | null
  readonly manifestResult?:
    | {
        readonly kind: 'agent_not_found'
      }
    | {
        readonly kind: 'manifest_unavailable'
        readonly channel: string
      }
    | {
        readonly kind: 'resolved'
        readonly manifest: {
          readonly version: string
          readonly downloadUrl: string
          readonly checksum: string
          readonly channel: string
          readonly publishedAt: string
          readonly updateAvailable: boolean
          readonly desiredVersion: string | null
          readonly currentVersion: string
          readonly updateReadyVersion: string | null
          readonly restartRequired: boolean
          readonly restartRequestedAt: string | null
        }
      }
}) {
  const authenticateAgentToken = vi.fn(async () =>
    command.authResult === undefined
      ? {
          tenantId: TENANT_ID,
          agentId: AGENT_ID,
          hostname: 'agent-host',
          intervalSec: 60,
          capabilities: ['msc'],
        }
      : command.authResult,
  )
  const resolveForAgent = vi.fn(async () =>
    command.manifestResult === undefined
      ? {
          kind: 'resolved' as const,
          manifest: {
            version: '2.0.0',
            downloadUrl: 'https://example.com/agent/stable/2.0.0/agent-linux-x64.tar.gz',
            checksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            channel: 'stable',
            publishedAt: '2026-03-09T10:00:00.000Z',
            updateAvailable: true,
            desiredVersion: null,
            currentVersion: '1.0.0',
            updateReadyVersion: null,
            restartRequired: false,
            restartRequestedAt: null,
          },
        }
      : command.manifestResult,
  )

  const controllers = createUpdateManifestControllers({
    authenticateAgentToken: {
      authenticateAgentToken,
    },
    updateManifestService: {
      resolveForAgent,
    },
  })

  return {
    controllers,
    authenticateAgentToken,
    resolveForAgent,
  }
}

describe('update manifest controllers', () => {
  it('returns 401 when authorization token is missing', async () => {
    const { controllers } = createControllers({})
    const response = await controllers.getUpdateManifest({
      request: new Request('http://localhost/api/agent/update-manifest'),
    })

    expect(response.status).toBe(401)
  })

  it('returns 200 with manifest payload when resolved', async () => {
    const { controllers, resolveForAgent } = createControllers({})
    const response = await controllers.getUpdateManifest({
      request: new Request('http://localhost/api/agent/update-manifest', {
        headers: {
          authorization: 'Bearer token-123',
        },
      }),
    })

    const body = AgentUpdateManifestResponseSchema.parse(await response.json())
    expect(response.status).toBe(200)
    expect(body.channel).toBe('stable')
    expect(body.version).toBe('2.0.0')
    expect(body.published_at).toBe('2026-03-09T10:00:00.000Z')
    expect(resolveForAgent).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
    })
  })

  it('returns 204 when no channel manifest is available', async () => {
    const { controllers } = createControllers({
      manifestResult: {
        kind: 'manifest_unavailable',
        channel: 'stable',
      },
    })
    const response = await controllers.getUpdateManifest({
      request: new Request('http://localhost/api/agent/update-manifest', {
        headers: {
          authorization: 'Bearer token-123',
        },
      }),
    })

    expect(response.status).toBe(204)
  })
})
