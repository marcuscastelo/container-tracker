import { describe, expect, it, vi } from 'vitest'

import { createTrackingUseCases } from '~/modules/tracking/application/tracking.usecases'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { TrackingAlertAckSource } from '~/modules/tracking/domain/model/trackingAlert'
import { createTrackingControllers } from '~/modules/tracking/interface/http/tracking.controllers'

function createControllers() {
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

  const deps: TrackingUseCasesDeps = {
    snapshotRepository: {
      insert: vi.fn(async () => {
        throw new Error('not used')
      }),
      findLatestByContainerId: vi.fn(async () => null),
      findAllByContainerId: vi.fn(async () => []),
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
      findActiveByContainerId: vi.fn(async () => []),
      findByContainerId: vi.fn(async () => []),
      findActiveTypesByContainerId: vi.fn(async () => new Set<string>()),
      acknowledge,
      unacknowledge,
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
  }
}

describe('tracking controllers', () => {
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
})
