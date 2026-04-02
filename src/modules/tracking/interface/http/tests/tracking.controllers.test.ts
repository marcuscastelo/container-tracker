import { describe, expect, it, vi } from 'vitest'

import { createTrackingUseCases } from '~/modules/tracking/application/tracking.usecases'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type {
  TrackingAlert,
  TrackingAlertAckSource,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import maerskPayload from '~/modules/tracking/infrastructure/carriers/tests/fixtures/maersk/maersk_full.json'
import { createTrackingControllers } from '~/modules/tracking/interface/http/tracking.controllers'
import { temporalValueFromCanonical } from '~/shared/time/tests/helpers'

function createControllers(options?: {
  readonly activeAlerts?: readonly TrackingAlert[]
  readonly containerNumberByContainerId?: ReadonlyMap<string, string>
  readonly observationsByContainerId?: ReadonlyMap<string, readonly Observation[]>
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
  const findAllObservationsByContainerId = vi.fn(async (containerId: string) => {
    return options?.observationsByContainerId?.get(containerId) ?? []
  })
  const findObservationById = vi.fn(async (containerId: string, observationId: string) => {
    const observations = options?.observationsByContainerId?.get(containerId) ?? []
    return observations.find((observation) => observation.id === observationId) ?? null
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
      findAllByContainerId: findAllObservationsByContainerId,
      findAllByContainerIds: vi.fn(async (containerIds: readonly string[]) =>
        containerIds.flatMap(
          (containerId) => options?.observationsByContainerId?.get(containerId) ?? [],
        ),
      ),
      findById: findObservationById,
      findFingerprintsByContainerId: vi.fn(async () => new Set<string>()),
      listSearchObservations: vi.fn(async () => []),
    },
    trackingAlertRepository: {
      insertMany: vi.fn(async () => []),
      listActiveAlertReadModel: vi.fn(async () => []),
      findActiveByContainerId,
      findActiveByContainerIds: vi.fn(async (containerIds: readonly string[]) => {
        const requestedIds = new Set(containerIds)
        return (options?.activeAlerts ?? []).filter((alert) => requestedIds.has(alert.container_id))
      }),
      findByContainerId: vi.fn(async () => []),
      findAlertDerivationStateByContainerId: vi.fn(async () => []),
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
    findAllObservationsByContainerId,
    findObservationById,
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

    const {
      controllers,
      findActiveByContainerId,
      findAllObservationsByContainerId,
      findContainerNumbersByIds,
    } = createControllers({
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
    expect(findAllObservationsByContainerId).not.toHaveBeenCalled()
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

  it('series-history drilldown returns lazy timeline history for a primary item', async () => {
    const containerId = 'container-series'
    const observations: readonly Observation[] = [
      {
        id: 'obs-expected-1',
        fingerprint: 'fp-expected-1',
        container_id: containerId,
        container_number: 'MSCU1234567',
        type: 'ARRIVAL',
        event_time: temporalValueFromCanonical('2026-03-10T10:00:00.000Z'),
        event_time_type: 'EXPECTED',
        location_code: 'NLRTM',
        location_display: 'Rotterdam',
        vessel_name: null,
        voyage: null,
        is_empty: null,
        confidence: 'high',
        provider: 'maersk',
        created_from_snapshot_id: 'snapshot-1',
        carrier_label: 'MAERSK',
        created_at: '2026-03-01T10:00:00.000Z',
        retroactive: false,
      },
      {
        id: 'obs-expected-2',
        fingerprint: 'fp-expected-2',
        container_id: containerId,
        container_number: 'MSCU1234567',
        type: 'ARRIVAL',
        event_time: temporalValueFromCanonical('2026-03-12T10:00:00.000Z'),
        event_time_type: 'EXPECTED',
        location_code: 'NLRTM',
        location_display: 'Rotterdam',
        vessel_name: null,
        voyage: null,
        is_empty: null,
        confidence: 'high',
        provider: 'maersk',
        created_from_snapshot_id: 'snapshot-2',
        carrier_label: 'MAERSK',
        created_at: '2026-03-02T10:00:00.000Z',
        retroactive: false,
      },
    ]

    const { controllers, findAllObservationsByContainerId } = createControllers({
      observationsByContainerId: new Map([[containerId, observations]]),
    })

    const request = new Request(
      `http://localhost/api/tracking/containers/${containerId}/timeline-items/obs-expected-2/history?now=2026-03-05T00:00:00.000Z`,
    )
    const response = await controllers.detail.getTimelineItemSeriesHistory({
      params: { containerId, timelineItemId: 'obs-expected-2' },
      request,
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.has_actual_conflict).toBe(false)
    expect(body.classified).toHaveLength(2)
    expect(body.classified.map((item: { id: string }) => item.id)).toEqual([
      'obs-expected-1',
      'obs-expected-2',
    ])
    expect(findAllObservationsByContainerId).toHaveBeenCalledWith(containerId)
  })

  it('observation-inspector drilldown returns a single observation payload', async () => {
    const containerId = 'container-observation'
    const observation: Observation = {
      id: 'obs-1',
      fingerprint: 'fp-1',
      container_id: containerId,
      container_number: 'MSCU7654321',
      type: 'DELIVERY',
      event_time: temporalValueFromCanonical('2026-03-15T14:00:00.000Z'),
      event_time_type: 'ACTUAL',
      location_code: 'BRSSZ',
      location_display: 'Santos',
      vessel_name: null,
      voyage: null,
      is_empty: false,
      confidence: 'high',
      provider: 'maersk',
      created_from_snapshot_id: 'snapshot-3',
      carrier_label: 'MAERSK',
      created_at: '2026-03-15T14:01:00.000Z',
      retroactive: false,
    }

    const { controllers, findObservationById } = createControllers({
      observationsByContainerId: new Map([[containerId, [observation]]]),
    })

    const response = await controllers.detail.getObservationInspector({
      params: { containerId, observationId: observation.id },
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      id: 'obs-1',
      type: 'DELIVERY',
      location_display: 'Santos',
      carrier_label: 'MAERSK',
    })
    expect(findObservationById).toHaveBeenCalledWith(containerId, observation.id)
  })

  it('time-travel endpoint returns snapshot checkpoints', async () => {
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

    const request = new Request(
      `http://localhost/api/tracking/containers/${containerId}/time-travel`,
    )
    const response = await controllers.timeTravel.getTimeTravel({
      params: { containerId },
      request,
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.container_id).toBe(containerId)
    expect(body.sync_count).toBe(1)
    expect(body.selected_snapshot_id).toBe('snapshot-1')
    expect(body.syncs[0]?.snapshot_id).toBe('snapshot-1')
    expect(body.syncs[0]?.diff_from_previous.kind).toBe('initial')
  })

  it('time-travel endpoint rejects now values without timezone', async () => {
    const containerId = 'container-replay-invalid-now'
    const { controllers } = createControllers()

    const request = new Request(
      `http://localhost/api/tracking/containers/${containerId}/time-travel?now=2026-02-03T15:00:00.000`,
    )
    const response = await controllers.timeTravel.getTimeTravel({
      params: { containerId },
      request,
    })

    expect(response.status).toBe(400)
  })

  it('time-travel debug endpoint returns selected snapshot debug payload', async () => {
    const containerId = 'container-replay-debug'
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
      `http://localhost/api/tracking/containers/${containerId}/time-travel/snapshot-1/debug`,
    )
    const response = await controllers.timeTravel.getReplayDebug({
      params: { containerId, snapshotId: 'snapshot-1' },
      request,
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.container_id).toBe(containerId)
    expect(body.snapshot_id).toBe('snapshot-1')
    expect(body.total_steps).toBeGreaterThan(0)
    expect(body.checkpoint.snapshot_id).toBe('snapshot-1')
    expect(
      body.steps.every(
        (step: { readonly snapshot_id: string | null }) => step.snapshot_id === 'snapshot-1',
      ),
    ).toBe(true)
  })

  it('time-travel debug endpoint returns 404 for unknown snapshot id', async () => {
    const containerId = 'container-replay-missing-debug'
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
      `http://localhost/api/tracking/containers/${containerId}/time-travel/unknown/debug`,
    )
    const response = await controllers.timeTravel.getReplayDebug({
      params: { containerId, snapshotId: 'unknown' },
      request,
    })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('Replay snapshot not found')
  })
})
