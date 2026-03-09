import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod/v4'

import type {
  AgentMonitoringRecord,
  AgentMonitoringRepository,
} from '~/modules/agent/application/agent-monitoring.repository'
import { createAgentUpdateManifestService } from '~/modules/agent/application/update-manifest.service'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const AGENT_ID = '22222222-2222-4222-8222-222222222222'

const BASE_RECORD: AgentMonitoringRecord = {
  agentId: AGENT_ID,
  tenantId: TENANT_ID,
  hostname: 'agent-host',
  version: '1.0.0',
  currentVersion: '1.0.0',
  desiredVersion: null,
  updateChannel: 'stable',
  updaterState: 'idle',
  updaterLastCheckedAt: null,
  updaterLastError: null,
  updateReadyVersion: null,
  restartRequestedAt: null,
  bootStatus: 'healthy',
  status: 'CONNECTED',
  enrolledAt: '2026-03-09T10:00:00.000Z',
  lastSeenAt: '2026-03-09T10:01:00.000Z',
  activeJobs: 0,
  capabilities: ['msc', 'cmacgm'],
  realtimeState: 'SUBSCRIBED',
  processingState: 'idle',
  leaseHealth: 'healthy',
  enrollmentMethod: 'bootstrap-token',
  tokenIdMasked: 'tok_1234',
  intervalSec: 60,
  lastError: null,
  queueLagSeconds: null,
}

function createRepository(
  record: AgentMonitoringRecord | null,
): Pick<AgentMonitoringRepository, 'getAgentDetailForTenant'> {
  return {
    getAgentDetailForTenant: vi.fn(async () => record),
  }
}

function createManifestDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-manifest-service-'))
}

function writeManifestFile(command: {
  readonly manifestsDir: string
  readonly channel: string
  readonly version: string
  readonly mode?: 'legacy' | 'unified'
}): void {
  const manifestPath = path.join(command.manifestsDir, `${command.channel}.json`)
  const mode = command.mode ?? 'legacy'
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true })

  const payload =
    mode === 'legacy'
      ? {
          channel: command.channel,
          version: command.version,
          download_url: `https://example.com/agent/${command.channel}/${command.version}/agent-linux-x64.tar.gz`,
          checksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          published_at: '2026-03-09T10:00:00.000Z',
        }
      : {
          channel: command.channel,
          version: command.version,
          platforms: {
            'linux-x64': {
              url: `https://example.com/agent/${command.channel}/${command.version}/agent-linux-x64.tar.gz`,
              checksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            },
            'windows-x64': {
              url: `https://example.com/agent/${command.channel}/${command.version}/agent-windows-x64.zip`,
              checksum: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            },
          },
          published_at: '2026-03-09T10:00:00.000Z',
        }

  fs.writeFileSync(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

const bundledStableManifestSchema = z.object({
  version: z.string().min(1),
})

describe('agent update manifest service', () => {
  it('parses manifest and serves legacy updates when desired_version is equivalent to current', async () => {
    const manifestsDir = createManifestDir()
    writeManifestFile({
      manifestsDir,
      channel: 'stable',
      version: '2.0.0',
    })

    const service = createAgentUpdateManifestService({
      repository: createRepository({
        ...BASE_RECORD,
        currentVersion: '1.0.0',
        desiredVersion: '1.0.0',
      }),
      manifestsDir,
    })

    const result = await service.resolveForAgent({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
    })

    expect(result.kind).toBe('resolved')
    if (result.kind !== 'resolved') return
    expect(result.manifest.channel).toBe('stable')
    expect(result.manifest.version).toBe('2.0.0')
    expect(result.manifest.updateAvailable).toBe(true)
    expect(result.manifest.desiredVersion).toBeNull()
  })

  it('falls back to stable manifest when requested channel file is missing', async () => {
    const manifestsDir = createManifestDir()
    writeManifestFile({
      manifestsDir,
      channel: 'stable',
      version: '2.1.0',
    })

    const service = createAgentUpdateManifestService({
      repository: createRepository({
        ...BASE_RECORD,
        currentVersion: '1.0.0',
        desiredVersion: null,
        updateChannel: 'canary',
      }),
      manifestsDir,
    })

    const result = await service.resolveForAgent({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
    })

    expect(result.kind).toBe('resolved')
    if (result.kind !== 'resolved') return
    expect(result.manifest.channel).toBe('stable')
    expect(result.manifest.version).toBe('2.1.0')
    expect(result.manifest.updateAvailable).toBe(true)
  })

  it('keeps update unavailable when desired_version does not match channel manifest', async () => {
    const manifestsDir = createManifestDir()
    writeManifestFile({
      manifestsDir,
      channel: 'stable',
      version: '2.0.0',
    })

    const service = createAgentUpdateManifestService({
      repository: createRepository({
        ...BASE_RECORD,
        currentVersion: '1.0.0',
        desiredVersion: '3.0.0',
        updateChannel: 'stable',
      }),
      manifestsDir,
    })

    const result = await service.resolveForAgent({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
    })

    expect(result.kind).toBe('resolved')
    if (result.kind !== 'resolved') return
    expect(result.manifest.updateAvailable).toBe(false)
    expect(result.manifest.desiredVersion).toBe('3.0.0')
  })

  it('selects platform-specific asset from unified manifest', async () => {
    const manifestsDir = createManifestDir()
    writeManifestFile({
      manifestsDir,
      channel: 'stable',
      version: '2.2.0',
      mode: 'unified',
    })

    const service = createAgentUpdateManifestService({
      repository: createRepository({
        ...BASE_RECORD,
        currentVersion: '1.0.0',
      }),
      manifestsDir,
    })

    const result = await service.resolveForAgent({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
      platform: 'windows-x64',
    })

    expect(result.kind).toBe('resolved')
    if (result.kind !== 'resolved') return
    expect(result.manifest.downloadUrl).toContain('agent-windows-x64.zip')
    expect(result.manifest.checksum).toBe(
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    )
  })

  it('returns manifest_unavailable when no channel manifest exists', async () => {
    const manifestsDir = createManifestDir()
    const service = createAgentUpdateManifestService({
      repository: createRepository({
        ...BASE_RECORD,
        updateChannel: 'dev',
      }),
      manifestsDir,
    })

    const result = await service.resolveForAgent({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
    })

    expect(result).toEqual({
      kind: 'manifest_unavailable',
      channel: 'dev',
      reason: 'manifest_missing',
    })
  })

  it('resolves manifests from bundled json imports when using default manifestsDir', async () => {
    const repoRoot = process.cwd()
    const bundledStablePath = path.join(repoRoot, 'agent-manifests', 'stable.json')
    const bundledStableRaw = fs.readFileSync(bundledStablePath, 'utf8')
    const bundledStableManifest = bundledStableManifestSchema.parse(JSON.parse(bundledStableRaw))

    const service = createAgentUpdateManifestService({
      repository: createRepository({
        ...BASE_RECORD,
        currentVersion: 'unknown',
        desiredVersion: null,
      }),
      manifestsDir: 'agent-manifests',
    })

    const result = await service.resolveForAgent({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
    })

    expect(result.kind).toBe('resolved')
    if (result.kind !== 'resolved') return
    expect(result.manifest.version).toBe(bundledStableManifest.version)
    expect(result.manifest.updateAvailable).toBe(true)
  })
})
