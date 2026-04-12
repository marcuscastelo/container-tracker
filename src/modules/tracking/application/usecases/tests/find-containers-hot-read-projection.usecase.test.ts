import { describe, expect, it, vi } from 'vitest'
import { findContainersHotReadProjection } from '~/modules/tracking/application/usecases/find-containers-hot-read-projection.usecase'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { TrackingAlert } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type { TrackingContainmentState } from '~/modules/tracking/features/containment/domain/model/trackingContainment'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import {
  instantFromIsoText,
  resolveTemporalValue,
  temporalValueFromCanonical,
} from '~/shared/time/tests/helpers'

function makeObservation(
  containerId: string,
  containerNumber: string,
  overrides: Partial<Observation> = {},
): Observation {
  return {
    id: `obs-${containerId}-${overrides.type ?? 'ARRIVAL'}`,
    fingerprint: `fp-${containerId}-${overrides.type ?? 'ARRIVAL'}`,
    container_id: containerId,
    container_number: containerNumber,
    type: 'ARRIVAL',
    event_time: resolveTemporalValue(
      overrides.event_time,
      temporalValueFromCanonical('2026-02-20T10:00:00.000Z'),
    ),
    event_time_type: overrides.event_time_type ?? 'EXPECTED',
    location_code: 'BRSSZ',
    location_display: 'Santos',
    vessel_name: null,
    voyage: null,
    is_empty: null,
    confidence: 'high',
    provider: 'msc',
    created_from_snapshot_id: 'snapshot-1',
    created_at: '2026-02-10T10:00:00.000Z',
    retroactive: false,
    ...overrides,
  }
}

function createDeps(args?: {
  readonly observations?: readonly Observation[]
  readonly activeAlerts?: readonly TrackingAlert[]
  readonly containmentStatesByContainerId?: ReadonlyMap<string, TrackingContainmentState>
  readonly failActiveAlerts?: boolean
}) {
  const observations = args?.observations ?? []
  const activeAlerts = args?.activeAlerts ?? []
  const containmentStatesByContainerId = args?.containmentStatesByContainerId ?? new Map()
  const findAllByContainerId = vi.fn(async (containerId: string) =>
    observations.filter((observation) => observation.container_id === containerId),
  )
  const findAllByContainerIds = vi.fn(async (containerIds: readonly string[]) => {
    const requestedIds = new Set(containerIds)
    return observations.filter((observation) => requestedIds.has(observation.container_id))
  })
  const findAllSnapshotsByContainerId = vi.fn(
    async (_containerId: string): Promise<readonly Snapshot[]> => [],
  )
  const findActiveByContainerIds = vi.fn(async (containerIds: readonly string[]) => {
    if (args?.failActiveAlerts === true) {
      throw new Error('active alert batch failed')
    }
    const requestedIds = new Set(containerIds)
    return activeAlerts.filter((alert) => requestedIds.has(alert.container_id))
  })
  const findActiveContainmentByContainerIds = vi.fn(async (containerIds: readonly string[]) => {
    const requestedIds = new Set(containerIds)
    return new Map(
      [...containmentStatesByContainerId.entries()].filter(([containerId]) =>
        requestedIds.has(containerId),
      ),
    )
  })

  const deps: TrackingUseCasesDeps = {
    observationRepository: {
      insertMany: vi.fn(async () => []),
      findAllByContainerId,
      findAllByContainerIds,
      findFingerprintsByContainerId: vi.fn(async () => new Set<string>()),
      listSearchObservations: vi.fn(async () => []),
    },
    snapshotRepository: {
      insert: vi.fn(async () => {
        throw new Error('not used')
      }),
      findLatestByContainerId: vi.fn(async (): Promise<Snapshot | null> => null),
      findAllByContainerId: findAllSnapshotsByContainerId,
    },
    trackingAlertRepository: {
      insertMany: vi.fn(async () => []),
      findActiveByContainerId: vi.fn(async (): Promise<readonly TrackingAlert[]> => []),
      findActiveByContainerIds,
      findByContainerId: vi.fn(async (): Promise<readonly TrackingAlert[]> => []),
      findAlertDerivationStateByContainerId: vi.fn(async () => []),
      findContainerNumbersByIds: vi.fn(async () => new Map<string, string>()),
      findActiveTypesByContainerId: vi.fn(async () => new Set<string>()),
      listActiveAlertReadModel: vi.fn(async () => []),
      acknowledge: vi.fn(async () => undefined),
      unacknowledge: vi.fn(async () => undefined),
      autoResolveMany: vi.fn(async () => undefined),
    },
    syncMetadataRepository: {
      listByContainerNumbers: vi.fn(async () => []),
    },
    trackingContainmentRepository: {
      findActiveByContainerId: vi.fn(async (containerId: string) => {
        return containmentStatesByContainerId.get(containerId) ?? null
      }),
      findActiveByContainerIds: findActiveContainmentByContainerIds,
      activate: vi.fn(async () => undefined),
    },
  }

  return {
    deps,
    findAllByContainerId,
    findAllByContainerIds,
    findAllSnapshotsByContainerId,
    findActiveByContainerIds,
    findActiveContainmentByContainerIds,
  }
}

describe('findContainersHotReadProjection', () => {
  it('builds hot-read detail data with batch observation and alert reads', async () => {
    const observations = [
      makeObservation('c1', 'MSCU1111111', {
        type: 'LOAD',
        event_time: temporalValueFromCanonical('2026-02-10T10:00:00.000Z'),
        event_time_type: 'ACTUAL',
      }),
      makeObservation('c2', 'MSCU2222222', {
        type: 'DELIVERY',
        event_time: temporalValueFromCanonical('2026-02-12T10:00:00.000Z'),
        event_time_type: 'ACTUAL',
      }),
    ]
    const activeAlerts: readonly TrackingAlert[] = [
      {
        id: 'alert-1',
        container_id: 'c1',
        category: 'monitoring',
        type: 'ETA_PASSED',
        severity: 'danger',
        message_key: 'alerts.etaPassed',
        message_params: {},
        detected_at: '2026-02-13T10:00:00.000Z',
        triggered_at: '2026-02-13T10:00:00.000Z',
        source_observation_fingerprints: ['fp-c1-LOAD'],
        alert_fingerprint: null,
        retroactive: false,
        provider: null,
        acked_at: null,
        acked_by: null,
        acked_source: null,
      },
    ]
    const {
      deps,
      findAllByContainerId,
      findAllByContainerIds,
      findActiveByContainerIds,
      findActiveContainmentByContainerIds,
    } = createDeps({
      observations,
      activeAlerts,
    })

    const result = await findContainersHotReadProjection(deps, {
      containers: [
        { containerId: 'c1', containerNumber: 'MSCU1111111', podLocationCode: 'BRSSZ' },
        { containerId: 'c2', containerNumber: 'MSCU2222222', podLocationCode: 'BRSSZ' },
      ],
      now: instantFromIsoText('2026-02-15T00:00:00.000Z'),
    })

    expect(findAllByContainerIds).toHaveBeenCalledTimes(1)
    expect(findAllByContainerIds).toHaveBeenCalledWith(['c1', 'c2'])
    expect(findActiveByContainerIds).toHaveBeenCalledTimes(1)
    expect(findActiveByContainerIds).toHaveBeenCalledWith(['c1', 'c2'])
    expect(findActiveContainmentByContainerIds).toHaveBeenCalledTimes(1)
    expect(findActiveContainmentByContainerIds).toHaveBeenCalledWith(['c1', 'c2'])
    expect(findAllByContainerId).not.toHaveBeenCalled()
    expect(result.containers).toHaveLength(2)
    expect(result.containers[0]?.containerId).toBe('c1')
    expect(result.containers[0]?.activeAlerts).toHaveLength(1)
    expect(result.containers[0]?.trackingContainment).toBeNull()
    expect(result.containers[0]?.trackingValidation).toEqual({
      hasIssues: false,
      findingCount: 0,
      highestSeverity: null,
      activeIssues: [],
      topIssue: null,
    })
    expect(result.activeAlerts).toHaveLength(1)
    expect(result.activeOperationalIncidents.summary.activeIncidentCount).toBe(1)
    expect(result.activeOperationalIncidents.summary.affectedContainerCount).toBe(1)
  })

  it('aligns timeline primary and operational ETA to the latest observed expected revision', async () => {
    const observations = [
      makeObservation('c1', 'FCIU2000205', {
        id: 'eta-08',
        fingerprint: 'fp-eta-08',
        type: 'ARRIVAL',
        event_time: temporalValueFromCanonical('2026-05-08'),
        event_time_type: 'EXPECTED',
        vessel_name: 'MSC BIANCA SILVIA',
        voyage: 'UX614R',
        created_at: '2026-04-04T16:08:30.906851Z',
      }),
      makeObservation('c1', 'FCIU2000205', {
        id: 'eta-12',
        fingerprint: 'fp-eta-12',
        type: 'ARRIVAL',
        event_time: temporalValueFromCanonical('2026-05-12'),
        event_time_type: 'EXPECTED',
        vessel_name: 'MSC BIANCA SILVIA',
        voyage: 'UX614R',
        created_at: '2026-04-08T20:05:19.293794Z',
      }),
      makeObservation('c1', 'FCIU2000205', {
        id: 'eta-03',
        fingerprint: 'fp-eta-03',
        type: 'ARRIVAL',
        event_time: temporalValueFromCanonical('2026-05-03'),
        event_time_type: 'EXPECTED',
        vessel_name: 'MSC BIANCA SILVIA',
        voyage: 'UX614R',
        created_at: '2026-04-10T10:36:02.943421Z',
      }),
      makeObservation('c1', 'FCIU2000205', {
        id: 'eta-05',
        fingerprint: 'fp-eta-05',
        type: 'ARRIVAL',
        event_time: temporalValueFromCanonical('2026-05-05'),
        event_time_type: 'EXPECTED',
        vessel_name: 'MSC BIANCA SILVIA',
        voyage: 'UX614R',
        created_at: '2026-04-10T17:37:48.410353Z',
      }),
    ]
    const { deps } = createDeps({ observations })

    const result = await findContainersHotReadProjection(deps, {
      containers: [{ containerId: 'c1', containerNumber: 'FCIU2000205', podLocationCode: 'BRSSZ' }],
      now: instantFromIsoText('2026-04-11T00:00:00.000Z'),
    })
    const container = result.containers[0]

    expect(container?.timeline).toHaveLength(1)
    expect(container?.timeline[0]?.id).toBe('eta-05')
    expect(container?.timeline[0]?.eventTime).toEqual({
      kind: 'date',
      value: '2026-05-05',
      timezone: null,
    })
    expect(container?.operational.eta?.eventTime).toEqual({
      kind: 'date',
      value: '2026-05-05',
      timezone: null,
    })
    expect(container?.operational.eta?.state).toBe('ACTIVE_EXPECTED')
  })

  it('marks the container when conflicting critical ACTUALs exist in the same series', async () => {
    const conflictingObservations = [
      makeObservation('c1', 'MSCU1111111', {
        id: 'obs-c1-discharge-1',
        fingerprint: 'fp-c1-discharge-1',
        type: 'DISCHARGE',
        event_time: temporalValueFromCanonical('2026-02-10T10:00:00.000Z'),
        event_time_type: 'ACTUAL',
        created_at: '2026-02-10T10:30:00.000Z',
      }),
      makeObservation('c1', 'MSCU1111111', {
        id: 'obs-c1-discharge-2',
        fingerprint: 'fp-c1-discharge-2',
        type: 'DISCHARGE',
        event_time: temporalValueFromCanonical('2026-02-11T10:00:00.000Z'),
        event_time_type: 'ACTUAL',
        created_at: '2026-02-11T10:30:00.000Z',
      }),
    ]
    const { deps } = createDeps({
      observations: conflictingObservations,
    })

    const result = await findContainersHotReadProjection(deps, {
      containers: [{ containerId: 'c1', containerNumber: 'MSCU1111111', podLocationCode: 'BRSSZ' }],
      now: instantFromIsoText('2026-02-15T00:00:00.000Z'),
    })

    expect(result.containers[0]?.trackingValidation).toEqual({
      hasIssues: true,
      findingCount: 1,
      highestSeverity: 'CRITICAL',
      activeIssues: [
        {
          code: 'CONFLICTING_CRITICAL_ACTUALS',
          severity: 'CRITICAL',
          reasonKey: 'tracking.validation.conflictingCriticalActuals',
          affectedArea: 'series',
          affectedLocation: 'BRSSZ',
          affectedBlockLabelKey: null,
        },
      ],
      topIssue: {
        code: 'CONFLICTING_CRITICAL_ACTUALS',
        severity: 'CRITICAL',
        reasonKey: 'tracking.validation.conflictingCriticalActuals',
        affectedArea: 'series',
        affectedLocation: 'BRSSZ',
        affectedBlockLabelKey: null,
      },
    })
  })

  it('returns containment state without surfacing post-completion reuse as tracking validation', async () => {
    const postCompletionObservations = [
      makeObservation('c1', 'MSCU1111111', {
        id: 'obs-c1-discharge-1',
        fingerprint: 'fp-c1-discharge-1',
        type: 'DISCHARGE',
        event_time: temporalValueFromCanonical('2026-02-10T10:00:00.000Z'),
        event_time_type: 'ACTUAL',
        created_at: '2026-02-10T10:30:00.000Z',
      }),
      makeObservation('c1', 'MSCU1111111', {
        id: 'obs-c1-delivery-1',
        fingerprint: 'fp-c1-delivery-1',
        type: 'DELIVERY',
        event_time: temporalValueFromCanonical('2026-02-11T10:00:00.000Z'),
        event_time_type: 'ACTUAL',
        created_at: '2026-02-11T10:30:00.000Z',
        location_code: 'BRIOA',
        location_display: 'Itapoa',
        vessel_name: null,
        voyage: null,
      }),
      makeObservation('c1', 'MSCU1111111', {
        id: 'obs-c1-load-1',
        fingerprint: 'fp-c1-load-1',
        type: 'LOAD',
        event_time: temporalValueFromCanonical('2026-02-15T10:00:00.000Z'),
        event_time_type: 'ACTUAL',
        created_at: '2026-02-15T10:30:00.000Z',
        location_code: 'ITNAP',
        location_display: 'Naples',
        vessel_name: 'MSC RESUME',
        voyage: '777E',
      }),
    ]
    const containmentStatesByContainerId = new Map<string, TrackingContainmentState>([
      [
        'c1',
        {
          active: true,
          reasonCode: 'CONTAINER_REUSED_AFTER_COMPLETION',
          activatedAt: '2026-02-15T10:30:00.000Z',
          provider: 'msc',
          snapshotId: 'snapshot-containment-1',
          lifecycleKey: 'CONTAINER_REUSED_AFTER_COMPLETION:c1',
          stateFingerprint: 'containment-state-1',
          evidenceSummary: 'LOAD ACTUAL appeared after DELIVERED.',
        },
      ],
    ])
    const { deps } = createDeps({
      observations: postCompletionObservations,
      containmentStatesByContainerId,
    })

    const result = await findContainersHotReadProjection(deps, {
      containers: [{ containerId: 'c1', containerNumber: 'MSCU1111111', podLocationCode: 'BRSSZ' }],
      now: instantFromIsoText('2026-02-15T00:00:00.000Z'),
    })

    expect(result.containers[0]?.trackingContainment).toEqual({
      active: true,
      reasonCode: 'CONTAINER_REUSED_AFTER_COMPLETION',
      activatedAt: '2026-02-15T10:30:00.000Z',
    })
    expect(result.containers[0]?.trackingValidation).toEqual({
      hasIssues: false,
      findingCount: 0,
      highestSeverity: null,
      activeIssues: [],
      topIssue: null,
    })
  })

  it('does not mark the container when maritime context stays inside the canonical voyage block', async () => {
    const voyageObservations = [
      makeObservation('c1', 'MSCU1111111', {
        id: 'obs-c1-load-voyage',
        fingerprint: 'fp-c1-load-voyage',
        type: 'LOAD',
        event_time: temporalValueFromCanonical('2026-02-10T08:00:00.000Z'),
        event_time_type: 'ACTUAL',
        created_at: '2026-02-10T08:30:00.000Z',
        location_code: 'ITNAP',
        location_display: 'Naples',
        vessel_name: 'MSC ALPHA',
        voyage: '101E',
      }),
      makeObservation('c1', 'MSCU1111111', {
        id: 'obs-c1-departure-voyage',
        fingerprint: 'fp-c1-departure-voyage',
        type: 'DEPARTURE',
        event_time: temporalValueFromCanonical('2026-02-10T10:00:00.000Z'),
        event_time_type: 'ACTUAL',
        created_at: '2026-02-10T10:30:00.000Z',
        location_code: 'ITNAP',
        location_display: 'Naples',
        vessel_name: 'MSC ALPHA',
        voyage: '101E',
      }),
      makeObservation('c1', 'MSCU1111111', {
        id: 'obs-c1-arrival-voyage',
        fingerprint: 'fp-c1-arrival-voyage',
        type: 'ARRIVAL',
        event_time: temporalValueFromCanonical('2026-02-15T08:00:00.000Z'),
        event_time_type: 'ACTUAL',
        created_at: '2026-02-15T08:30:00.000Z',
        location_code: 'BRSSZ',
        location_display: 'Santos',
        vessel_name: 'MSC ALPHA',
        voyage: '101E',
      }),
      makeObservation('c1', 'MSCU1111111', {
        id: 'obs-c1-discharge-voyage',
        fingerprint: 'fp-c1-discharge-voyage',
        type: 'DISCHARGE',
        event_time: temporalValueFromCanonical('2026-02-15T11:00:00.000Z'),
        event_time_type: 'ACTUAL',
        created_at: '2026-02-15T11:30:00.000Z',
        location_code: 'BRSSZ',
        location_display: 'Santos',
        vessel_name: 'MSC ALPHA',
        voyage: '101E',
      }),
    ]
    const { deps } = createDeps({
      observations: voyageObservations,
    })

    const result = await findContainersHotReadProjection(deps, {
      containers: [{ containerId: 'c1', containerNumber: 'MSCU1111111', podLocationCode: 'BRSSZ' }],
      now: instantFromIsoText('2026-02-17T00:00:00.000Z'),
    })

    expect(result.containers[0]?.trackingValidation).toEqual({
      hasIssues: false,
      findingCount: 0,
      highestSeverity: null,
      activeIssues: [],
      topIssue: null,
    })
  })

  it('marks the container with ADVISORY when a stray maritime event lands in post-carriage', async () => {
    const advisoryObservations = [
      makeObservation('c1', 'MSCU1111111', {
        id: 'obs-c1-load-1',
        fingerprint: 'fp-c1-load-1',
        type: 'LOAD',
        event_time: temporalValueFromCanonical('2026-02-10T08:00:00.000Z'),
        event_time_type: 'ACTUAL',
        created_at: '2026-02-10T08:30:00.000Z',
        location_code: 'ITNAP',
        location_display: 'Naples',
        vessel_name: 'MSC ALPHA',
        voyage: '101E',
      }),
      makeObservation('c1', 'MSCU1111111', {
        id: 'obs-c1-departure-1',
        fingerprint: 'fp-c1-departure-1',
        type: 'DEPARTURE',
        event_time: temporalValueFromCanonical('2026-02-10T10:00:00.000Z'),
        event_time_type: 'ACTUAL',
        created_at: '2026-02-10T10:30:00.000Z',
        location_code: 'ITNAP',
        location_display: 'Naples',
        vessel_name: 'MSC ALPHA',
        voyage: '101E',
      }),
      makeObservation('c1', 'MSCU1111111', {
        id: 'obs-c1-arrival-1',
        fingerprint: 'fp-c1-arrival-1',
        type: 'ARRIVAL',
        event_time: temporalValueFromCanonical('2026-02-15T08:00:00.000Z'),
        event_time_type: 'ACTUAL',
        created_at: '2026-02-15T08:30:00.000Z',
        location_code: 'BRSSZ',
        location_display: 'Santos',
        vessel_name: 'MSC ALPHA',
        voyage: '101E',
      }),
      makeObservation('c1', 'MSCU1111111', {
        id: 'obs-c1-discharge-1',
        fingerprint: 'fp-c1-discharge-1',
        type: 'DISCHARGE',
        event_time: temporalValueFromCanonical('2026-02-15T11:00:00.000Z'),
        event_time_type: 'ACTUAL',
        created_at: '2026-02-15T11:30:00.000Z',
        location_code: 'BRSSZ',
        location_display: 'Santos',
        vessel_name: 'MSC ALPHA',
        voyage: '101E',
      }),
      makeObservation('c1', 'MSCU1111111', {
        id: 'obs-c1-post-carriage-departure',
        fingerprint: 'fp-c1-post-carriage-departure',
        type: 'DEPARTURE',
        event_time: temporalValueFromCanonical('2026-02-16T09:00:00.000Z'),
        event_time_type: 'ACTUAL',
        created_at: '2026-02-16T09:30:00.000Z',
        location_code: 'BRSSZ',
        location_display: 'Santos',
        vessel_name: 'MSC SIGMA',
        voyage: '202W',
      }),
    ]
    const { deps } = createDeps({
      observations: advisoryObservations,
    })

    const result = await findContainersHotReadProjection(deps, {
      containers: [{ containerId: 'c1', containerNumber: 'MSCU1111111', podLocationCode: 'BRSSZ' }],
      now: instantFromIsoText('2026-02-17T00:00:00.000Z'),
    })

    expect(result.containers[0]?.trackingValidation).toEqual({
      hasIssues: true,
      findingCount: 1,
      highestSeverity: 'ADVISORY',
      activeIssues: [
        {
          code: 'CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT',
          severity: 'ADVISORY',
          reasonKey: 'tracking.validation.canonicalTimelineClassificationInconsistent',
          affectedArea: 'timeline',
          affectedLocation: 'Santos',
          affectedBlockLabelKey: 'shipmentView.timeline.blocks.postCarriage',
        },
      ],
      topIssue: {
        code: 'CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT',
        severity: 'ADVISORY',
        reasonKey: 'tracking.validation.canonicalTimelineClassificationInconsistent',
        affectedArea: 'timeline',
        affectedLocation: 'Santos',
        affectedBlockLabelKey: 'shipmentView.timeline.blocks.postCarriage',
      },
    })
  })

  it('marks the container when the same canonical voyage leg is duplicated across timeline blocks', async () => {
    const duplicatedSegmentObservations = [
      makeObservation('c1', 'PCIU8712104', {
        id: 'load-legacy',
        fingerprint: 'fp-load-legacy',
        type: 'LOAD',
        location_code: null,
        location_display: 'QINGDAO',
        vessel_name: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        event_time: temporalValueFromCanonical('2026-03-14T04:10:00.000Z'),
        event_time_type: 'ACTUAL',
        created_at: '2026-03-14T04:15:00.000Z',
      }),
      makeObservation('c1', 'PCIU8712104', {
        id: 'discharge-legacy',
        fingerprint: 'fp-discharge-legacy',
        type: 'DISCHARGE',
        location_code: null,
        location_display: 'SANTOS',
        vessel_name: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        event_time: temporalValueFromCanonical('2026-03-20T10:00:00.000Z'),
        event_time_type: 'EXPECTED',
        created_at: '2026-03-20T10:15:00.000Z',
      }),
      makeObservation('c1', 'PCIU8712104', {
        id: 'load-coded',
        fingerprint: 'fp-load-coded',
        type: 'LOAD',
        location_code: 'CNTAO',
        location_display: 'QINGDAO',
        vessel_name: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        event_time: temporalValueFromCanonical('2026-03-21T04:10:00.000Z'),
        event_time_type: 'ACTUAL',
        created_at: '2026-03-21T04:15:00.000Z',
      }),
      makeObservation('c1', 'PCIU8712104', {
        id: 'discharge-coded',
        fingerprint: 'fp-discharge-coded',
        type: 'DISCHARGE',
        location_code: 'BRSSZ',
        location_display: 'SANTOS',
        vessel_name: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        event_time: temporalValueFromCanonical('2026-04-23T19:00:00.000Z'),
        event_time_type: 'EXPECTED',
        created_at: '2026-04-23T19:15:00.000Z',
      }),
    ] satisfies readonly Observation[]
    const { deps } = createDeps({
      observations: duplicatedSegmentObservations,
    })

    const result = await findContainersHotReadProjection(deps, {
      containers: [{ containerId: 'c1', containerNumber: 'PCIU8712104', podLocationCode: 'BRSSZ' }],
      now: instantFromIsoText('2026-04-24T00:00:00.000Z'),
    })

    expect(result.containers[0]?.trackingValidation).toEqual({
      hasIssues: true,
      findingCount: 1,
      highestSeverity: 'CRITICAL',
      activeIssues: [
        {
          code: 'CANONICAL_TIMELINE_SEGMENT_DUPLICATED',
          severity: 'CRITICAL',
          reasonKey: 'tracking.validation.canonicalTimelineSegmentDuplicated',
          affectedArea: 'timeline',
          affectedLocation: 'QINGDAO',
          affectedBlockLabelKey: 'shipmentView.timeline.blocks.voyage',
        },
      ],
      topIssue: {
        code: 'CANONICAL_TIMELINE_SEGMENT_DUPLICATED',
        severity: 'CRITICAL',
        reasonKey: 'tracking.validation.canonicalTimelineSegmentDuplicated',
        affectedArea: 'timeline',
        affectedLocation: 'QINGDAO',
        affectedBlockLabelKey: 'shipmentView.timeline.blocks.voyage',
      },
    })
  })

  it('fails explicitly when the batch active-alert read fails', async () => {
    const { deps } = createDeps({
      observations: [makeObservation('c1', 'MSCU1111111')],
      failActiveAlerts: true,
    })

    await expect(
      findContainersHotReadProjection(deps, {
        containers: [{ containerId: 'c1', containerNumber: 'MSCU1111111' }],
        now: instantFromIsoText('2026-02-15T00:00:00.000Z'),
      }),
    ).rejects.toThrow('active alert batch failed')
  })

  it('serializes snapshot reads for PIL enrichment fallback to avoid concurrent fan-out', async () => {
    const { deps, findAllSnapshotsByContainerId } = createDeps({
      observations: [
        makeObservation('c1', 'MSCU1111111', {
          provider: 'pil',
          type: 'LOAD',
          location_code: null,
          created_from_snapshot_id: 'snapshot-c1',
        }),
        makeObservation('c2', 'MSCU2222222', {
          provider: 'pil',
          type: 'LOAD',
          location_code: null,
          created_from_snapshot_id: 'snapshot-c2',
        }),
      ],
    })
    let inFlightSnapshotReads = 0
    let maxInFlightSnapshotReads = 0

    findAllSnapshotsByContainerId.mockImplementation(async () => {
      inFlightSnapshotReads += 1
      maxInFlightSnapshotReads = Math.max(maxInFlightSnapshotReads, inFlightSnapshotReads)
      await Promise.resolve()
      inFlightSnapshotReads -= 1
      return []
    })

    await findContainersHotReadProjection(deps, {
      containers: [
        { containerId: 'c1', containerNumber: 'MSCU1111111' },
        { containerId: 'c2', containerNumber: 'MSCU2222222' },
      ],
      now: instantFromIsoText('2026-02-15T00:00:00.000Z'),
    })

    expect(findAllSnapshotsByContainerId).toHaveBeenCalledTimes(2)
    expect(maxInFlightSnapshotReads).toBe(1)
  })
})
