import { describe, expect, it, vi } from 'vitest'

import { createTrackingUseCases } from '~/modules/tracking/application/tracking.usecases'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type {
  TrackingAlert,
  TrackingAlertAckSource,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import maerskPayload from '~/modules/tracking/infrastructure/carriers/tests/fixtures/maersk/maersk_full.json'
import { createTrackingControllers } from '~/modules/tracking/interface/http/tracking.controllers'

function createControllers(options?: {
  readonly activeAlerts?: readonly TrackingAlert[]
  readonly containerNumberByContainerId?: ReadonlyMap<string, string>
  readonly snapshots?: readonly Snapshot[]
}) {
  const acknowledge = vi.fn(
    async (
      _alertId: string,
      _ackedAt: string,
      _metadata: {
        readonly ackedBy: string | null
        readonly ackedSource: TrackingAlertAckSource | null
      },
    ) => undefined,
  )
  const unacknowledge = vi.fn(async (_alertId: string) => undefined)
  const autoResolveMany = vi.fn(async () => undefined)
  const findActiveByContainerId = vi.fn(async (containerId: string) => {
    const alerts = options?.activeAlerts ?? []
    return alerts.filter((alert) => alert.container_id === containerId)
  })
  const findContainerNumbersByIds = vi.fn(async (containerIds: readonly string[]) => {
    const map = new Map<string, string>()
    const source = options?.containerNumberByContainerId ?? new Map<string, string>()

    for (const containerId of containerIds) {
      const containerNumber = source.get(containerId)
      if (containerNumber !== undefined) {
        map.set(containerId, containerNumber)
      }
    }

    return map
  })

  const deps: TrackingUseCasesDeps = {
    snapshotRepository: {
      insert: vi.fn(async () => {
        throw new Error('not used')
      }),
      findLatestByContainerId: vi.fn(async () => null),
      findAllByContainerId: vi.fn(async () => options?.snapshots ?? []),
      findByIds: vi.fn(async () => []),
    },
    observationRepository: {
      insertMany: vi.fn(async () => []),
      findAllByContainerId: vi.fn(async () => []),
      findFingerprintsByContainerId: vi.fn(async () => new Set<string>()),
      listSearchObservations: vi.fn(async () => []),
    },
    trackingAlertRepository: {
      insertMany: vi.fn(async () => []),
      listActiveAlertReadModel: vi.fn(async () => []),
      findActiveByContainerId,
      findByContainerId: vi.fn(async () => []),
      findContainerNumbersByIds,
      findActiveTypesByContainerId: vi.fn(async () => new Set<string>()),
      acknowledge,
      unacknowledge,
      autoResolveMany,
    },
    syncMetadataRepository: {
      listByContainerNumbers: vi.fn(async () => []),
    },
  }

  const trackingUseCases = createTrackingUseCases(deps)
  const controllers = createTrackingControllers({ trackingUseCases })

  return {
    controllers,
    acknowledge,
    unacknowledge,
    autoResolveMany,
    findActiveByContainerId,
    findContainerNumbersByIds,
  }
}

describe('tracking controllers', () => {
  it('list alerts returns enriched display DTO with container and semantic message contract', async () => {
    const containerId = 'container-1'
    const activeAlerts: readonly TrackingAlert[] = [
      {
        id: 'alert-1',
        container_id: containerId,
        category: 'fact',
        type: 'TRANSSHIPMENT',
        severity: 'warning',
        message_key: 'alerts.transshipmentDetected',
        message_params: {
          port: 'MAPTM02',
          fromVessel: 'MAERSK NARMADA',
          toVessel: 'CMA CGM LISA MARIE',
        },
        detected_at: '2026-03-01T10:00:00.000Z',
        triggered_at: '2026-03-01T10:00:00.000Z',
        source_observation_fingerprints: ['fp-1', 'fp-2'],
        alert_fingerprint: 'fp-alert',
        retroactive: false,
        provider: 'maersk',
        acked_at: null,
        acked_by: null,
        acked_source: null,
      },
    ]

    const { controllers, findActiveByContainerId, findContainerNumbersByIds } = createControllers({
      activeAlerts,
      containerNumberByContainerId: new Map([[containerId, 'MRSU8798130']]),
    })

    const request = new Request(`http://localhost/api/alerts?container_id=${containerId}`)
    const response = await controllers.alerts.listAlerts({ request })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual([
      {
        id: 'alert-1',
        container_number: 'MRSU8798130',
        category: 'fact',
        type: 'TRANSSHIPMENT',
        severity: 'warning',
        message_key: 'alerts.transshipmentDetected',
        message_params: {
          port: 'MAPTM02',
          fromVessel: 'MAERSK NARMADA',
          toVessel: 'CMA CGM LISA MARIE',
        },
        detected_at: '2026-03-01T10:00:00.000Z',
        triggered_at: '2026-03-01T10:00:00.000Z',
        retroactive: false,
        provider: 'maersk',
        lifecycle_state: 'ACTIVE',
        acked_at: null,
        resolved_at: null,
        resolved_reason: null,
      },
    ])
    expect(findActiveByContainerId).toHaveBeenCalledWith(containerId)
    expect(findContainerNumbersByIds).toHaveBeenCalledWith([containerId])
  })

  it('acknowledge action sends null metadata when fields are omitted', async () => {
    const { controllers, acknowledge, unacknowledge } = createControllers()

    const request = new Request('http://localhost/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alert_id: 'alert-1',
        action: 'acknowledge',
      }),
    })

    const response = await controllers.alerts.handleAlertAction({ request })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true, alert_id: 'alert-1', action: 'acknowledge' })
    expect(unacknowledge).not.toHaveBeenCalled()
    expect(acknowledge).toHaveBeenCalledTimes(1)

    const call = acknowledge.mock.calls[0]
    expect(call?.[0]).toBe('alert-1')
    expect(typeof call?.[1]).toBe('string')
    expect(Number.isNaN(Date.parse(String(call?.[1])))).toBe(false)
    expect(call?.[2]).toEqual({
      ackedBy: null,
      ackedSource: null,
    })
  })

  it('acknowledge action preserves explicit ack metadata', async () => {
    const { controllers, acknowledge } = createControllers()

    const request = new Request('http://localhost/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alert_id: 'alert-2',
        action: 'acknowledge',
        acked_by: 'operator@container-tracker',
        acked_source: 'dashboard',
      }),
    })

    const response = await controllers.alerts.handleAlertAction({ request })

    expect(response.status).toBe(200)
    expect(acknowledge).toHaveBeenCalledTimes(1)

    const call = acknowledge.mock.calls[0]
    expect(call?.[0]).toBe('alert-2')
    expect(call?.[2]).toEqual({
      ackedBy: 'operator@container-tracker',
      ackedSource: 'dashboard',
    })
  })

  it('unacknowledge action uses unacknowledge flow', async () => {
    const { controllers, acknowledge, unacknowledge } = createControllers()

    const request = new Request('http://localhost/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alert_id: 'alert-3',
        action: 'unacknowledge',
      }),
    })

    const response = await controllers.alerts.handleAlertAction({ request })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true, alert_id: 'alert-3', action: 'unacknowledge' })
    expect(acknowledge).not.toHaveBeenCalled()
    expect(unacknowledge).toHaveBeenCalledTimes(1)
    expect(unacknowledge).toHaveBeenCalledWith('alert-3')
  })

  it('replay endpoint returns a step-by-step reconstruction payload', async () => {
    const containerId = 'container-replay'
    const { controllers } = createControllers({
      snapshots: [
        {
          id: 'snapshot-1',
          container_id: containerId,
          provider: 'maersk',
          fetched_at: '2026-02-03T15:00:00.000Z',
          payload: maerskPayload,
        },
      ],
    })

    const request = new Request(`http://localhost/api/tracking/replay/${containerId}`)
    const response = await controllers.replay.getReplay({
      params: { containerId },
      request,
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.container_id).toBe(containerId)
    expect(body.total_snapshots).toBe(1)
    expect(body.total_steps).toBeGreaterThan(0)
    expect(body.steps[0]?.stage).toBe('SNAPSHOT')
  })

  it('replay steps endpoint paginates with cursor and limit', async () => {
    const containerId = 'container-replay-steps'
    const { controllers } = createControllers({
      snapshots: [
        {
          id: 'snapshot-1',
          container_id: containerId,
          provider: 'maersk',
          fetched_at: '2026-02-03T15:00:00.000Z',
          payload: maerskPayload,
        },
      ],
    })

    const request = new Request(
      `http://localhost/api/tracking/replay/${containerId}/steps?limit=1&cursor=0`,
    )
    const response = await controllers.replay.getReplaySteps({
      params: { containerId },
      request,
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.container_id).toBe(containerId)
    expect(body.steps).toHaveLength(1)
    expect(body.next_cursor).toBe(1)
  })

  it('replay step snapshot endpoint returns a single step state', async () => {
    const containerId = 'container-replay-step-snapshot'
    const { controllers } = createControllers({
      snapshots: [
        {
          id: 'snapshot-1',
          container_id: containerId,
          provider: 'maersk',
          fetched_at: '2026-02-03T15:00:00.000Z',
          payload: maerskPayload,
        },
      ],
    })

    const request = new Request(`http://localhost/api/tracking/replay/${containerId}/snapshot/1`)
    const response = await controllers.replay.getReplayStepSnapshot({
      params: { containerId, step: '1' },
      request,
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.container_id).toBe(containerId)
    expect(body.step_index).toBe(1)
    expect(body.step.stage).toBe('SNAPSHOT')
  })
})
