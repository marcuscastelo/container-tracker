import { describe, expect, it, vi } from 'vitest'
import {
  type GetContainerSummaryCommand,
  getContainerSummary,
} from '~/modules/tracking/application/usecases/get-container-summary.usecase'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import { computeFingerprint } from '~/modules/tracking/domain/identity/fingerprint'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.active-alert.readmodel'
import type { TrackingAlert } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { ObservationDraft } from '~/modules/tracking/features/observation/domain/model/observationDraft'

type ObservationOverrides = {
  readonly type?: Observation['type']
  readonly fingerprint?: string
  readonly carrierLabel?: string | null
  readonly createdFromSnapshotId?: string
  readonly eventTime?: string | null
  readonly eventTimeType?: Observation['event_time_type']
  readonly locationCode?: string | null
}

function makeObservation(overrides: ObservationOverrides = {}): Observation {
  return {
    id: 'obs-1',
    fingerprint: overrides.fingerprint ?? 'fp-1',
    container_id: 'container-1',
    container_number: 'MSCU1234567',
    type: overrides.type ?? 'LOAD',
    event_time: overrides.eventTime ?? '2026-02-10T10:00:00.000Z',
    event_time_type: overrides.eventTimeType ?? 'ACTUAL',
    location_code: overrides.locationCode ?? 'BRSSZ',
    location_display: 'Santos, BR',
    vessel_name: null,
    voyage: null,
    is_empty: true,
    confidence: 'high',
    provider: 'maersk',
    created_from_snapshot_id: overrides.createdFromSnapshotId ?? 'snapshot-1',
    carrier_label: overrides.carrierLabel ?? null,
    created_at: '2026-02-10T10:00:00.000Z',
    retroactive: false,
  }
}

function makeMaerskSnapshot(snapshotId: string): Snapshot {
  return {
    id: snapshotId,
    container_id: 'container-1',
    provider: 'maersk',
    fetched_at: '2026-02-10T11:00:00.000Z',
    payload: {
      containers: [
        {
          container_num: 'MSCU1234567',
          locations: [
            {
              city: 'Santos',
              country_code: 'BR',
              events: [
                {
                  activity: 'Container returned empty',
                  event_time: '2026-02-10T10:00:00.000Z',
                  event_time_type: 'ACTUAL',
                  locationCode: 'BRSSZ',
                  stempty: true,
                  vessel_name: null,
                  voyage_num: null,
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

type DepsWithSpies = {
  readonly deps: TrackingUseCasesDeps
  readonly findSnapshotsByIds: ReturnType<typeof vi.fn>
  readonly findAllSnapshotsByContainerId: ReturnType<typeof vi.fn>
}

function createDeps(
  observations: readonly Observation[],
  snapshots: readonly Snapshot[],
): DepsWithSpies {
  const findSnapshotsByIds = vi.fn(
    async (_containerId: string, _snapshotIds: readonly string[]): Promise<readonly Snapshot[]> =>
      snapshots,
  )
  const findAllSnapshotsByContainerId = vi.fn(
    async (_containerId: string): Promise<readonly Snapshot[]> => snapshots,
  )

  const deps: TrackingUseCasesDeps = {
    observationRepository: {
      insertMany: vi.fn(async () => []),
      findAllByContainerId: vi.fn(async () => observations),
      findFingerprintsByContainerId: vi.fn(async () => new Set<string>()),
      listSearchObservations: vi.fn(async () => []),
    },
    snapshotRepository: {
      insert: vi.fn(async () => {
        throw new Error('not used')
      }),
      findLatestByContainerId: vi.fn(async (): Promise<Snapshot | null> => null),
      findAllByContainerId: findAllSnapshotsByContainerId,
      findByIds: findSnapshotsByIds,
    },
    trackingAlertRepository: {
      insertMany: vi.fn(async () => []),
      listActiveAlertReadModel: vi.fn(
        async (): Promise<readonly TrackingActiveAlertReadModel[]> => [],
      ),
      findActiveByContainerId: vi.fn(async (): Promise<readonly TrackingAlert[]> => []),
      findByContainerId: vi.fn(async (): Promise<readonly TrackingAlert[]> => []),
      findContainerNumbersByIds: vi.fn(async () => new Map<string, string>()),
      findActiveTypesByContainerId: vi.fn(async () => new Set<string>()),
      acknowledge: vi.fn(async () => undefined),
      unacknowledge: vi.fn(async () => undefined),
    },
    syncMetadataRepository: {
      listByContainerNumbers: vi.fn(async () => []),
    },
  }

  return { deps, findSnapshotsByIds, findAllSnapshotsByContainerId }
}

function makeCommand(): GetContainerSummaryCommand {
  return {
    containerId: 'container-1',
    containerNumber: 'MSCU1234567',
    podLocationCode: 'BRSSZ',
    now: new Date('2026-02-12T00:00:00.000Z'),
  }
}

describe('getContainerSummary', () => {
  it('does not load snapshots when no OTHER observations require enrichment', async () => {
    const observation = makeObservation({
      type: 'LOAD',
      carrierLabel: null,
      createdFromSnapshotId: 'snapshot-1',
    })
    const { deps, findSnapshotsByIds, findAllSnapshotsByContainerId } = createDeps(
      [observation],
      [],
    )

    const result = await getContainerSummary(deps, makeCommand())

    expect(findSnapshotsByIds).not.toHaveBeenCalled()
    expect(findAllSnapshotsByContainerId).not.toHaveBeenCalled()
    expect(result.observations[0]?.carrier_label).toBeNull()
  })

  it('enriches legacy OTHER observation carrier label using targeted snapshot ids', async () => {
    const legacyOtherDraft: ObservationDraft = {
      container_number: 'MSCU1234567',
      type: 'OTHER',
      event_time: '2026-02-10T10:00:00.000Z',
      event_time_type: 'ACTUAL',
      location_code: 'BRSSZ',
      location_display: 'Santos, BR',
      vessel_name: null,
      voyage: null,
      is_empty: true,
      confidence: 'high',
      provider: 'maersk',
      snapshot_id: 'snapshot-1',
      carrier_label: null,
    }
    const legacyFingerprint = computeFingerprint(legacyOtherDraft)
    const legacyObservation = makeObservation({
      type: 'OTHER',
      fingerprint: legacyFingerprint,
      carrierLabel: null,
      createdFromSnapshotId: 'snapshot-1',
      eventTime: '2026-02-10T10:00:00.000Z',
      eventTimeType: 'ACTUAL',
      locationCode: 'BRSSZ',
    })
    const snapshot = makeMaerskSnapshot('snapshot-1')
    const { deps, findSnapshotsByIds, findAllSnapshotsByContainerId } = createDeps(
      [legacyObservation],
      [snapshot],
    )

    const result = await getContainerSummary(deps, makeCommand())

    expect(findSnapshotsByIds).toHaveBeenCalledTimes(1)
    expect(findSnapshotsByIds).toHaveBeenCalledWith('container-1', ['snapshot-1'])
    expect(findAllSnapshotsByContainerId).not.toHaveBeenCalled()
    expect(result.observations[0]?.carrier_label).toBe('Container returned empty')
  })

  it('loads active + acknowledged alerts when includeAcknowledgedAlerts is enabled', async () => {
    const observation = makeObservation({
      type: 'LOAD',
      carrierLabel: null,
      createdFromSnapshotId: 'snapshot-1',
    })

    const { deps } = createDeps([observation], [])
    const findAllAlerts = vi.fn(
      async (): Promise<readonly TrackingAlert[]> => [
        {
          id: 'alert-active',
          container_id: 'container-1',
          category: 'monitoring',
          type: 'NO_MOVEMENT',
          severity: 'warning',
          message_key: 'alerts.noMovementDetected',
          message_params: {
            days: 7,
            lastEventDate: '2026-03-05',
          },
          detected_at: '2026-03-05T10:00:00.000Z',
          triggered_at: '2026-03-05T10:00:00.000Z',
          source_observation_fingerprints: ['fp-1'],
          alert_fingerprint: null,
          retroactive: false,
          provider: null,
          acked_at: null,
          acked_by: null,
          acked_source: null,
        },
        {
          id: 'alert-acked',
          container_id: 'container-1',
          category: 'fact',
          type: 'TRANSSHIPMENT',
          severity: 'warning',
          message_key: 'alerts.transshipmentDetected',
          message_params: {
            port: 'SGSIN',
            fromVessel: 'VESSEL A',
            toVessel: 'VESSEL B',
          },
          detected_at: '2026-03-04T10:00:00.000Z',
          triggered_at: '2026-03-04T10:00:00.000Z',
          source_observation_fingerprints: ['fp-1'],
          alert_fingerprint: 'fp-alert',
          retroactive: false,
          provider: null,
          acked_at: '2026-03-05T12:00:00.000Z',
          acked_by: null,
          acked_source: null,
        },
      ],
    )

    deps.trackingAlertRepository.findByContainerId = findAllAlerts

    const result = await getContainerSummary(deps, {
      ...makeCommand(),
      includeAcknowledgedAlerts: true,
    })

    expect(findAllAlerts).toHaveBeenCalledTimes(1)
    expect(result.alerts.length).toBe(2)
    expect(result.alerts.some((alert) => alert.acked_at !== null)).toBe(true)
  })
})
