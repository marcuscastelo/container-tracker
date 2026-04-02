import { describe, expect, it, vi } from 'vitest'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import { listActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/usecases/list-active-alert-read-model.usecase'
import type { TrackingAlert } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'

function createDeps(
  listActiveAlertReadModelImpl: TrackingUseCasesDeps['trackingAlertRepository']['listActiveAlertReadModel'],
): TrackingUseCasesDeps {
  return {
    observationRepository: {
      insertMany: vi.fn(async () => []),
      findAllByContainerId: vi.fn(async () => []),
      findAllByContainerIds: vi.fn(async () => []),
      findFingerprintsByContainerId: vi.fn(async () => new Set<string>()),
      listSearchObservations: vi.fn(async () => []),
    },
    snapshotRepository: {
      insert: vi.fn(async () => {
        throw new Error('not used')
      }),
      findLatestByContainerId: vi.fn(async (): Promise<Snapshot | null> => null),
      findAllByContainerId: vi.fn(async (): Promise<readonly Snapshot[]> => []),
    },
    trackingAlertRepository: {
      insertMany: vi.fn(async () => []),
      findActiveByContainerId: vi.fn(async (): Promise<readonly TrackingAlert[]> => []),
      findActiveByContainerIds: vi.fn(async (): Promise<readonly TrackingAlert[]> => []),
      findByContainerId: vi.fn(async (): Promise<readonly TrackingAlert[]> => []),
      findAlertDerivationStateByContainerId: vi.fn(async () => []),
      findContainerNumbersByIds: vi.fn(async () => new Map<string, string>()),
      findActiveTypesByContainerId: vi.fn(async () => new Set<string>()),
      listActiveAlertReadModel: listActiveAlertReadModelImpl,
      acknowledge: vi.fn(async () => undefined),
      unacknowledge: vi.fn(async () => undefined),
      autoResolveMany: vi.fn(async () => undefined),
    },
    syncMetadataRepository: {
      listByContainerNumbers: vi.fn(async () => []),
    },
  }
}

describe('listActiveAlertReadModel', () => {
  it('returns only active alerts and preserves fact/monitoring types', async () => {
    const deps = createDeps(async () => [
      {
        alert_id: 'alert-fact',
        process_id: 'process-1',
        container_id: 'container-1',
        category: 'fact',
        severity: 'warning',
        type: 'TRANSSHIPMENT',
        message_key: 'alerts.transshipmentDetected',
        message_params: {
          port: 'SANTOS',
          fromVessel: 'A',
          toVessel: 'B',
        },
        generated_at: '2026-03-03T01:00:00.000Z',
        fingerprint: 'fp-fact',
        is_active: true,
        retroactive: true,
      },
      {
        alert_id: 'alert-inactive',
        process_id: 'process-1',
        container_id: 'container-1',
        category: 'monitoring',
        severity: 'warning',
        type: 'NO_MOVEMENT',
        message_key: 'alerts.noMovementDetected',
        message_params: {
          threshold_days: 10,
          days_without_movement: 11,
          days: 11,
          lastEventDate: '2026-02-20',
        },
        generated_at: '2026-03-03T02:00:00.000Z',
        fingerprint: null,
        is_active: false,
        retroactive: false,
      },
      {
        alert_id: 'alert-monitoring',
        process_id: 'process-2',
        container_id: 'container-2',
        category: 'monitoring',
        severity: 'danger',
        type: 'ETA_PASSED',
        message_key: 'alerts.etaPassed',
        message_params: {},
        generated_at: '2026-03-03T03:00:00.000Z',
        fingerprint: null,
        is_active: true,
        retroactive: false,
      },
    ])

    const result = await listActiveAlertReadModel(deps)

    expect(result.alerts).toEqual([
      {
        alert_id: 'alert-fact',
        process_id: 'process-1',
        container_id: 'container-1',
        category: 'fact',
        severity: 'warning',
        type: 'TRANSSHIPMENT',
        message_key: 'alerts.transshipmentDetected',
        message_params: {
          port: 'SANTOS',
          fromVessel: 'A',
          toVessel: 'B',
        },
        generated_at: '2026-03-03T01:00:00.000Z',
        fingerprint: 'fp-fact',
        is_active: true,
        retroactive: true,
      },
      {
        alert_id: 'alert-monitoring',
        process_id: 'process-2',
        container_id: 'container-2',
        category: 'monitoring',
        severity: 'danger',
        type: 'ETA_PASSED',
        message_key: 'alerts.etaPassed',
        message_params: {},
        generated_at: '2026-03-03T03:00:00.000Z',
        fingerprint: null,
        is_active: true,
        retroactive: false,
      },
    ])
  })
})
