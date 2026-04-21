import { beforeEach, describe, expect, it, vi } from 'vitest'

const createTrackingUseCasesMock = vi.hoisted(() =>
  vi.fn(() => ({
    getLatestSnapshot: vi.fn(),
  })),
)

const snapshotRepository = vi.hoisted(() => ({
  insert: vi.fn(),
  findLatestByContainerId: vi.fn(),
  findAllByContainerId: vi.fn(),
}))
const observationRepository = vi.hoisted(() => ({
  insertMany: vi.fn(),
  findAllByContainerId: vi.fn(),
  findAllByContainerIds: vi.fn(),
  findFingerprintsByContainerId: vi.fn(),
  listSearchObservations: vi.fn(),
}))
const trackingAlertRepository = vi.hoisted(() => ({
  insertMany: vi.fn(),
  findActiveByContainerId: vi.fn(),
  findActiveByContainerIds: vi.fn(),
  findByContainerId: vi.fn(),
  findAlertDerivationStateByContainerId: vi.fn(),
  findContainerNumbersByIds: vi.fn(),
  findActiveTypesByContainerId: vi.fn(),
  listActiveAlertReadModel: vi.fn(),
  acknowledge: vi.fn(),
  unacknowledge: vi.fn(),
  autoResolveMany: vi.fn(),
}))
const syncMetadataRepository = vi.hoisted(() => ({
  listByContainerNumbers: vi.fn(),
}))
const trackingContainmentRepository = vi.hoisted(() => ({
  findActiveByContainerId: vi.fn(),
  findActiveByContainerIds: vi.fn(),
  activate: vi.fn(),
}))
const trackingValidationLifecycleRepository = vi.hoisted(() => ({
  findActiveStatesByContainerId: vi.fn(),
  insertMany: vi.fn(),
}))
const replayAdminRepository = vi.hoisted(() => ({
  findTargetByContainerNumber: vi.fn(),
  findTargetByContainerId: vi.fn(),
  listSnapshotsForReplay: vi.fn(),
  createRun: vi.fn(),
  updateRun: vi.fn(),
  createRunTarget: vi.fn(),
  updateRunTarget: vi.fn(),
  findGenerationPointer: vi.fn(),
  createGeneration: vi.fn(),
  persistGenerationDerivations: vi.fn(),
  listObservationsByGeneration: vi.fn(),
  listAlertsByGeneration: vi.fn(),
  activateGenerationPointer: vi.fn(),
  rollbackGenerationPointer: vi.fn(),
  getRun: vi.fn(),
}))
const replayLockRepository = vi.hoisted(() => ({
  acquire: vi.fn(),
  heartbeat: vi.fn(),
  release: vi.fn(),
  findActiveLockByContainerId: vi.fn(),
  hasActiveLockForContainerNumber: vi.fn(),
}))

vi.mock('~/modules/tracking/application/tracking.usecases', () => ({
  createTrackingUseCases: createTrackingUseCasesMock,
}))

vi.mock('~/modules/tracking/infrastructure/persistence/supabaseSnapshotRepository', () => ({
  supabaseSnapshotRepository: snapshotRepository,
}))

vi.mock('~/modules/tracking/infrastructure/persistence/supabaseObservationRepository', () => ({
  supabaseObservationRepository: observationRepository,
}))

vi.mock('~/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository', () => ({
  supabaseTrackingAlertRepository: trackingAlertRepository,
}))

vi.mock('~/modules/tracking/infrastructure/persistence/supabaseSyncMetadataRepository', () => ({
  supabaseSyncMetadataRepository: syncMetadataRepository,
}))

vi.mock(
  '~/modules/tracking/infrastructure/persistence/supabaseTrackingContainmentRepository',
  () => ({
    supabaseTrackingContainmentRepository: trackingContainmentRepository,
  }),
)

vi.mock(
  '~/modules/tracking/infrastructure/persistence/supabaseTrackingValidationLifecycleRepository',
  () => ({
    supabaseTrackingValidationLifecycleRepository: trackingValidationLifecycleRepository,
  }),
)

vi.mock(
  '~/modules/tracking/infrastructure/persistence/tracking-replay.repository.supabase',
  () => ({
    supabaseTrackingReplayAdminRepository: replayAdminRepository,
    supabaseTrackingReplayLockRepository: replayLockRepository,
  }),
)

import { bootstrapTrackingModule } from '~/modules/tracking/infrastructure/bootstrap/tracking.bootstrap'

describe('bootstrapTrackingModule', () => {
  beforeEach(() => {
    createTrackingUseCasesMock.mockClear()
  })

  it('wires default infrastructure repositories into tracking application usecases', () => {
    const module = bootstrapTrackingModule()

    expect(module.trackingUseCases).toEqual({
      getLatestSnapshot: expect.any(Function),
    })
    expect(createTrackingUseCasesMock).toHaveBeenCalledWith({
      snapshotRepository,
      observationRepository,
      trackingAlertRepository,
      syncMetadataRepository,
      trackingContainmentRepository,
      trackingValidationLifecycleRepository,
      replayAdminRepository,
      replayLockRepository,
    })
  })

  it('allows explicit repository overrides for local integration tests and alternate composition roots', () => {
    const overrideSnapshotRepository = {
      insert: vi.fn(),
      findLatestByContainerId: vi.fn(),
      findAllByContainerId: vi.fn(),
    }

    bootstrapTrackingModule({
      snapshotRepository: overrideSnapshotRepository,
    })

    expect(createTrackingUseCasesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotRepository: overrideSnapshotRepository,
        observationRepository,
      }),
    )
  })
})
